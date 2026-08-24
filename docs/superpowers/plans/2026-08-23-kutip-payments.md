# Kutip Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a client pay an invoice from a branded public page via **ToyyibPay** (FPX + e-wallet, Malaysia-first), and auto-reconcile the payment: verify the gateway webhook signature, flip the invoice to `PAID`, create a `Payment` row, generate a PDF receipt, and enqueue a WhatsApp confirmation message with the receipt.

**Architecture:** A public (unauthenticated) invoice page that creates a ToyyibPay bill and redirects to ToyyibPay's hosted checkout, plus a signed webhook endpoint that receives the payment callback. This completes the Phase 1 "full loop" from the PRD (§5, §10): generate → deliver → collect → reconcile.

**Tech Stack:** Next.js (App Router, TypeScript), Prisma + PostgreSQL, BullMQ + Redis, `fetch` (Node 20+) for ToyyibPay HTTP calls, the existing `@react-pdf/renderer` PDF generator, and the existing WhatsApp dispatch layer. The schema from the Foundation/Invoicing plans is the source of truth; this plan adds payment-gateway credentials to `Business` and consumes the existing `Payment`/`Invoice`/`MessageLog` models.

**Spec:** [docs/Kutip-PRD.md](../../Kutip-PRD.md)

## Global Constraints

- Malaysia-first (MYR); all money stored as `Decimal(10,2)` (§5, §9).
- Multi-tenancy: single shared Postgres schema, every tenant-owned table scoped by `tenantId` (§8, §9).
- **Payment & reconciliation** (§10): webhook → signature verified → invoice `PAID` → PDF receipt → WhatsApp confirmation enqueued.
- **All inbound webhooks must verify signatures before acting** (§11).
- Secrets (ToyyibPay `userSecretKey`, category codes) live in `.env` or encrypted on the `Business` row, never committed (§11).
- **Scope boundary:** Multi-gateway routing (Billplz, Stripe) is deferred to Pro (§5). ToyyibPay is the only gateway for MVP. The `payment_link` placeholder in the WhatsApp templates becomes a real invoice payment URL here.

---

### Task 1: Schema — ToyyibPay credentials and payment state

**Files:**
- Modify: `prisma/schema.prisma`
- Migration: `add_toyyibpay_config`
- Regenerate: `npx prisma generate`

**Interfaces:**
- Produces: ToyyibPay credential fields on `Business` (`toyyibpayUserSecretKey`, `toyyibpayCategoryCode`, `toyyibpaySandbox`).
- Produces: enhanced `Payment` fields for reconciliation (`status`, `externalRef`, `billCode`, `hashValue`).

**Proposed schema additions:**
```prisma
model Business {
  // ... existing ...
  toyyibpayUserSecretKey String?
  toyyibpayCategoryCode  String?
  toyyibpaySandbox       Boolean @default(true)
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
}

model Payment {
  // ... existing ...
  status      PaymentStatus @default(PENDING)
  externalRef String?       // merchant order ref (invoice id)
  billCode    String?       // ToyyibPay BillCode
  hashValue   String?       // verified callback hash
}
```

**Steps:**
- [ ] **Step 1:** Add the fields to the `Business` and `Payment` models.
- [ ] **Step 2:** Generate the migration via `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, save as a migration, and apply with `migrate deploy` (dev + test).
- [ ] **Step 3:** Run `npx prisma generate`.
- [ ] **Step 4:** Commit.

---

### Task 2: ToyyibPay API client

**Files:**
- Create: `src/lib/payments/toyyibpay.ts`
- Test: `src/lib/__tests__/payments-toyyibpay.unit.test.ts` (mocked fetch)

**Interfaces:**
- Produces: `createBill(business, invoice, payment): Promise<{ billCode: string, paymentUrl: string }>` — calls ToyyibPay's `createBill`.
- Produces: `verifyCallbackHash(payload, userSecretKey): boolean` — validates ToyyibPay's `hash_value`.
- Produces: `checkBillStatus(business, billCode): Promise<{ status: string }>` — calls `checkBill`.

**ToyyibPay endpoints (sandbox):**
- Create: `https://toyyibpay.com/index.php/api/createBill`
- Check: `https://toyyibpay.com/index.php/api/checkBill`
- Payment page: `https://toyyibpay.com/{billCode}` (sandbox prefix `https://dev.toyyibpay.com/{billCode}`)

**Signature:**
- `hash_value` is computed by ToyyibPay as `SHA1(billcode + order_id + status_id)` with the `userSecretKey`. The plan must implement verification matching the gateway's documented algorithm; make it configurable since ToyyibPay's exact hash scheme varies by integration.

- [ ] **Step 1:** Implement `createBill` posting form-encoded fields (`userSecretKey`, `categoryCode`, `billName`, `billDescription`, `billAmount`, `billTo`, `billEmail`, `billPhone`, `billReturnUrl`, `billCallbackUrl`, `billExternalReferenceNo`) and reading the returned `BillCode`.
- [ ] **Step 2:** Implement `verifyCallbackHash`.
- [ ] **Step 3:** Implement `checkBillStatus`.
- [ ] **Step 4:** Write unit tests with a mocked `fetch` verifying the request fields and the parsed `BillCode`.
- [ ] **Step 5:** Run `npm test` — expected PASS.
- [ ] **Step 6:** Commit.

---

### Task 3: Public invoice & payment page

**Files:**
- Create: `src/app/invoices/[invoiceId]/page.tsx`
- Create: `src/lib/payments/checkout.ts`
- Test: `src/lib/__tests__/payments-checkout.integration.test.ts`

**Interfaces:**
- Produces: `createPaymentForInvoice(invoiceId): Promise<{ paymentUrl: string }>` — ensures a `Payment` row (PENDING) exists, calls `createBill`, stores `billCode`, and returns the ToyyibPay payment URL.
- Produces: a public `/invoices/[invoiceId]` page rendering the invoice breakdown (client name, amount, due date, business name) and a "Pay Now" button that calls `createPaymentForInvoice` and redirects to ToyyibPay.

**Rules:**
- The page is **unauthenticated** (public) so the client can pay without an account.
- If the invoice is already `PAID`, show a "This invoice has been paid" state instead of a pay button.
- `billCallbackUrl` points to the webhook route from Task 4; `billReturnUrl` points back to a thank-you page.

- [ ] **Step 1:** Implement `createPaymentForInvoice`.
- [ ] **Step 2:** Implement the public invoice page with the paid/unpaid states.
- [ ] **Step 3:** Write integration tests asserting a PENDING `Payment` row is created and the payment URL is returned for an unpaid invoice, and that a paid invoice is handled correctly.
- [ ] **Step 4:** Run `npm run test:integration` — expected PASS.
- [ ] **Step 5:** Commit.

---

### Task 4: Payment webhook and reconciliation

**Files:**
- Create: `src/app/api/payments/toyyibpay/webhook/route.ts`
- Create: `src/lib/payments/reconcile.ts`
- Test: `src/lib/__tests__/payments-reconcile.integration.test.ts`

**Interfaces:**
- Produces: `reconcilePayment(payload): Promise<{ handled: boolean }>` — verifies the hash, finds the `Payment` by `billCode`/`externalRef`, flips the invoice to `PAID`, records the `Payment.status = PAID`, generates a receipt PDF, and enqueues a WhatsApp confirmation (Task 5).
- Produces: the signed webhook endpoint for ToyyibPay callbacks.

**Rules (§10, §11):**
- Verify `verifyCallbackHash` before acting; reject tampered callbacks.
- Only flip to `PAID` if the invoice is not already `PAID` (idempotent).
- On success: invoice `ISSUED`/`OVERDUE` → `PAID`; create/update the `Payment` row; generate the receipt PDF; enqueue the WhatsApp confirmation message.
- Never commit a financial side effect before signature verification.

- [ ] **Step 1:** Implement `reconcilePayment` with hash verification and the idempotent PAID transition.
- [ ] **Step 2:** Implement the webhook route that parses the ToyyibPay callback and calls `reconcilePayment`.
- [ ] **Step 3:** Write integration tests: a valid callback flips the invoice to `PAID` and creates the `Payment`; an invalid hash is rejected; a duplicate callback is idempotent.
- [ ] **Step 4:** Run `npm run test:integration` — expected PASS.
- [ ] **Step 5:** Commit.

---

### Task 5: Wire the real payment link and receipt dispatch

**Files:**
- Modify: `src/lib/whatsapp/templates.ts` (real `payment_link`)
- Modify: `src/lib/invoice/sweep.ts` or `src/lib/invoice/service.ts` (attach payment link at invoice creation)
- Create: `src/lib/payments/receiptDispatch.ts`

**Interfaces:**
- Produces: a real `payment_link` (the public invoice page URL) in the WhatsApp template variables instead of the `#placeholder-payment-link`.
- Produces: `dispatchPaymentConfirmation(paymentId): Promise<void>` — builds a "Payment Received — Thank You!" message, attaches the receipt PDF, and enqueues it for WhatsApp dispatch.

**Rules:**
- `payment_link` = `<baseUrl>/invoices/<invoiceId>` so the client can pay from the reminder.
- The payment confirmation message includes the receipt PDF (generated by the existing `generateReceiptPdf`).
- Confirmation dispatch reuses the same channel routing/guards as the reminder dispatcher.

- [ ] **Step 1:** Replace the placeholder payment link in `buildReminderPayload` with the real invoice URL.
- [ ] **Step 2:** Implement `dispatchPaymentConfirmation` using `generateReceiptPdf` and the WhatsApp dispatcher.
- [ ] **Step 3:** Write unit/integration tests asserting the payment link format and that confirmation dispatch is enqueued after reconciliation.
- [ ] **Step 4:** Run `npm test` and `npm run test:integration` — expected PASS.
- [ ] **Step 5:** Commit.

---

## Definition of Done

- `npm test` and `npm run test:integration` both pass.
- A `Business` with ToyyibPay credentials can create a bill and return a ToyyibPay payment URL for an unpaid invoice.
- The public invoice page shows the breakdown, a "Pay Now" button for unpaid invoices, and a "paid" state for paid invoices.
- A signed ToyyibPay callback reconciles the payment: invoice flipped to `PAID`, `Payment.status = PAID`, receipt PDF generated, confirmation message enqueued.
- Tampered callbacks and duplicate callbacks are handled safely (rejected / idempotent).
- The WhatsApp reminder's `payment_link` points to the real public invoice page.
- All tasks are committed as separate commits.