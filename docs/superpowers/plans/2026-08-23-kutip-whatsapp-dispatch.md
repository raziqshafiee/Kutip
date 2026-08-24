# Kutip WhatsApp Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver invoices and escalating reminders into the client's WhatsApp chat. A BullMQ worker consumes due `ReminderJob`s from the Invoicing Core, renders a WhatsApp template with the client's dynamic values, sends it through the business's configured channel, and records delivery status in `MessageLog`. Two channels ship from day one per the PRD: the official Meta WhatsApp Cloud API (default, ToS-safe) and an opt-in QR-session gateway (Baileys) for cost-sensitive merchants.

**Architecture:** A stateless HTTP sender for the Cloud API channel plus a persistent-socket Baileys worker for the QR channel, both running in the same DigitalOcean monolith per the PRD architecture (§8). The existing `ReminderJob` → `MessageLog` data flow from the Invoicing Core is the input; the WhatsApp Dispatch plan turns due reminders into real messages.

**Tech Stack:** Next.js (App Router, TypeScript), BullMQ + Redis, `@prisma/client`, `undici` or `fetch` (Node 20+) for the Cloud API HTTP calls, `baileys` for the QR-session channel. The schema from the Invoicing Core plan is the source of truth; this plan adds WhatsApp channel config to `Business` and consumes the existing `MessageLog`/`ReminderJob` models.

**Spec:** [docs/Kutip-PRD.md](../../Kutip-PRD.md)

## Global Constraints

- Multi-tenancy: single shared Postgres schema, every tenant-owned table scoped by `tenantId` (§8, §9).
- Both channels must be available from day 1: Meta WhatsApp Cloud API (default, reliable, ToS-safe) and QR-session via Baileys (opt-in "bootstrapping" channel) (§5).
- The QR-session gateway uses the unofficial WhatsApp Web protocol, **violates WhatsApp ToS**, and carries a real risk of the business's number being banned. It must be an **explicit opt-in with a clear warning**, never a default (§11).
- All inbound webhooks (payment gateway, WhatsApp) must verify signatures before acting (§11).
- Secrets (WhatsApp Cloud API tokens, QR session credentials) live in `.env`, never committed (§11).
- Template variables are `{{client_name}}`, `{{amount}}`, `{{service_name}}`, `{{payment_link}}` (§10).
- T+3/T+7 reminder jobs only fire if the invoice is still unpaid (§10) — already enforced by the Invoicing Core; this plan must not resend paid invoices.
- **Scope boundary:** Payment *collection* (ToyyibPay) is OUT of scope. This plan produces the `payment_link` as a placeholder (the Payments plan makes it real) and handles only the WhatsApp message delivery.

---

### Task 1: Schema — WhatsApp channel config on Business

**Files:**
- Modify: `prisma/schema.prisma` (add WhatsApp channel fields to `Business`)
- Migration: `prisma migrate dev --name add_whatsapp_channel`
- Regenerate: `npx prisma generate`

**Interfaces:**
- Produces: `Business.whatsappChannel` enum (`NONE` | `CLOUD_API` | `QR_SESSION`), plus channel-specific credential fields.
- Produces: a new enum `WhatsAppChannel` and nullable credential columns.

**Proposed schema additions:**
```prisma
enum WhatsAppChannel {
  NONE
  CLOUD_API
  QR_SESSION
}

model Business {
  // ... existing fields ...
  whatsappChannel          WhatsAppChannel @default(NONE)
  cloudApiPhoneNumberId    String?
  cloudApiAccessToken      String?
  cloudApiTemplateName     String?   // e.g. "invoice_reminder"
  qrSessionId              String?   // Baileys session id / auth state key
}
```

**Steps:**
- [ ] **Step 1:** Add the `WhatsAppChannel` enum and the credential columns to the `Business` model.
- [ ] **Step 2:** Run `npx prisma migrate dev --name add_whatsapp_channel`. If the environment is non-interactive, generate the diff via `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, save it as a migration, and apply with `prisma migrate deploy` (see the Invoicing Core plan for the exact procedure).
- [ ] **Step 3:** Run `npx prisma generate` to refresh client types.
- [ ] **Step 4:** Apply the same migration to the test DB with `npm run prisma:migrate:test`.
- [ ] **Step 5:** Commit.

---

### Task 2: Template rendering engine

**Files:**
- Create: `src/lib/whatsapp/templates.ts`
- Test: `src/lib/__tests__/whatsapp-templates.unit.test.ts`

**Interfaces:**
- Produces: `renderTemplate(template: string, vars: TemplateVars): string` — replaces `{{key}}` placeholders.
- Produces: `buildReminderPayload(invoiceId, stage): Promise<{ text: string, vars: TemplateVars }>` — loads the invoice, client, and business and assembles the variable set.

**Variable set (§10):**
- `{{client_name}}` → `Client.name`
- `{{amount}}` → formatted MYR amount
- `{{service_name}}` → `Client.serviceTier` (fallback to `Business.name`)
- `{{payment_link}}` → a placeholder URL for now (Payments plan makes it real)

**Rules:**
- Unmatched placeholders are left intact (Cloud API templates require a server-side template with matching parameters; QR channel sends free-form text).
- `{{amount}}` is formatted as `RM 150.00`.
- If `Business.whatsappChannel === 'NONE'`, `buildReminderPayload` still returns the payload; the sender (Task 4) decides not to send.

- [ ] **Step 1:** Implement `renderTemplate` with a simple regex replacement over `{{key}}`.
- [ ] **Step 2:** Implement `buildReminderPayload` querying `Invoice` → `Client` → `Business`.
- [ ] **Step 3:** Write unit tests for `renderTemplate` (single var, multiple vars, missing vars left intact).
- [ ] **Step 4:** Write a unit test for MYR amount formatting.
- [ ] **Step 5:** Run `npm test` — expected PASS.
- [ ] **Step 6:** Commit.

---

### Task 3: MessageLog writer and delivery-state helper

**Files:**
- Create: `src/lib/whatsapp/messageLog.ts`
- Test: `src/lib/__tests__/whatsapp-messageLog.integration.test.ts`

**Interfaces:**
- Produces: `createMessageLog({ invoiceId, channel, template, status }): Promise<MessageLog>`.
- Produces: `markMessageDelivered(messageLogId)` / `markMessageFailed(messageLogId, )` helpers for webhook/ack callbacks.

**Rules:**
- Every send attempt creates one `MessageLog` row linked to the invoice.
- `status` starts at `QUEUED` (the default), moves to `SENT` on dispatch, and to `DELIVERED`/`READ`/`FAILED` via webhooks or acks.

- [ ] **Step 1:** Implement `createMessageLog`.
- [ ] **Step 2:** Implement the status-mutation helpers.
- [ ] **Step 3:** Write integration tests creating a message log against `kutip_test` and asserting status transitions.
- [ ] **Step 4:** Run `npm run test:integration` — expected PASS.
- [ ] **Step 5:** Commit.

---

### Task 4: Meta WhatsApp Cloud API sender (default channel)

**Files:**
- Create: `src/lib/whatsapp/cloudApi.ts`
- Test: `src/lib/__tests__/whatsapp-cloudApi.unit.test.ts` (mocked HTTP)

**Interfaces:**
- Produces: `sendViaCloudApi(business, toE164, text): Promise<{ success: boolean, messageId?: string }>`.
- Produces: `dispatchReminder(invoiceId, stage): Promise<{ sent: boolean }>` — orchestrates: load payload → create `MessageLog` → send via configured channel → update status.

**Implementation:**
- Cloud API endpoint: `POST https://graph.facebook.com/v19.0/<phoneNumberId>/messages`
- Authorization: `Bearer <accessToken>`
- Body: `{ "messaging_product": "whatsapp", "to": "<e164>", "type": "text", "text": { "body": "<rendered text>" } }`
- **Notes on template messages:** for production, WhatsApp requires pre-registered message templates for the Cloud API. The MVP sends a text message for the QR channel and a registered template for Cloud API. Because templates require manual Meta setup, the plan keeps the Cloud API sender parameterized by a template name (defaulting to a text fallback during development).

- [ ] **Step 1:** Implement `sendViaCloudApi` using `fetch` and the business's stored credentials.
- [ ] **Step 2:** Implement `dispatchReminder` that:
  1. loads payload via `buildReminderPayload`
  2. skips if `Business.whatsappChannel === 'NONE'`
  3. creates a `MessageLog` in `QUEUED`
  4. sends via the configured channel
  5. updates the `MessageLog` to `SENT` (or `FAILED`) and marks the `ReminderJob` `SENT`
- [ ] **Step 3:** Write unit tests with a mocked `fetch` verifying the request shape (URL, headers, body) and the success/failure paths.
- [ ] **Step 4:** Run `npm test` — expected PASS.
- [ ] **Step 5:** Commit.

---

### Task 5: Wire the reminder worker to dispatch

**Files:**
- Modify: `src/lib/invoice/worker.ts`
- Test: `src/lib/__tests__/whatsapp-dispatch.integration.test.ts`

**Interfaces:**
- Produces: a real reminder-dispatch worker that consumes `ReminderDispatchJob` (`{ invoiceId, stage }`) and calls `dispatchReminder`.
- Produces: end-to-end verification that a due reminder produces a `MessageLog` and marks the `ReminderJob` `SENT`.

**Rules:**
- When `Business.whatsappChannel === 'CLOUD_API'`, call `dispatchReminder`.
- When `Business.whatsappChannel === 'QR_SESSION'`, route to the QR worker (Task 6).
- When `Business.whatsappChannel === 'NONE'`, mark the `ReminderJob` `SKIPPED` and create no `MessageLog`.
- Do **not** dispatch for a `PAID` invoice (guard against T+3/T+7 resends).

- [ ] **Step 1:** Replace the placeholder reminder worker in `worker.ts` with a real dispatcher that reads `ReminderDispatchJob`.
- [ ] **Step 2:** Implement the channel routing and the `NONE`/paid guards.
- [ ] **Step 3:** Write an integration test: seed a business (Cloud API) + client + issued invoice + due `ReminderJob`, run the dispatcher, assert a `MessageLog` is created and the `ReminderJob` becomes `SENT`.
- [ ] **Step 4:** Run `npm run test:integration` — expected PASS.
- [ ] **Step 5:** Commit.

---

### Task 6: QR-session channel via Baileys (opt-in)

**Files:**
- Install: `baileys`, `@whiskeysockets/baileys` (check current package name), `pino`
- Create: `src/lib/whatsapp/qrSession.ts`
- Create: `src/lib/whatsapp/qrWorker.ts`

**Interfaces:**
- Produces: `sendViaQrSession(business, toE164, text): Promise<{ success: boolean }>`.
- Produces: a persistent Baileys socket per connected business number, with session state persisted to a volume, and a QR-code flow for linking a number.

**Implementation notes:**
- Baileys maintains one persistent socket per business number; session state (auth keys) persists to disk/volume (`qrSessionId` on `Business`).
- On startup, the QR worker loads all `Business` rows with `whatsappChannel === 'QR_SESSION'`, connects sockets, and handles reconnects.
- QR linking flow: a pending business gets a QR code surface; the merchant scans it in WhatsApp to link their number. This is an **explicit opt-in** step with the ToS warning displayed.
- Use `@whiskeysockets/baileys` (the maintained fork) if the original `baileys` package is unmaintained at implementation time.

- [ ] **Step 1:** Install Baileys and pino.
- [ ] **Step 2:** Implement `sendViaQrSession` to send a text message over the connected socket.
- [ ] **Step 3:** Implement the QR worker that connects persistent sockets for all QR-enabled businesses, including a connection lifecycle and reconnect handling.
- [ ] **Step 4:** Implement the QR linking surface (a minimal route or CLI) that surfaces the QR code and requires explicit opt-in acknowledgment of the ToS risk.
- [ ] **Step 5:** Add a unit/integration test that asserts `sendViaQrSession` is wired to the socket send path (mock the socket if Baileys cannot run headless in CI).
- [ ] **Step 6:** Commit.

---

### Task 7: Delivery-status webhooks and reconciliation

**Files:**
- Create: `src/app/api/whatsapp/webhook/route.ts` (Cloud API status callbacks)
- Create: `src/lib/whatsapp/webhook.ts`
- Test: `src/lib/__tests__/whatsapp-webhook.unit.test.ts`

**Interfaces:**
- Produces: a signed webhook endpoint for Meta Cloud API status callbacks (`sent`/`delivered`/`read`/`failed`).
- Produces: `handleDeliveryStatus(messageLogId, status)` that updates the `MessageLog`.

**Rules (§11):**
- Verify the incoming webhook signature (Meta's `X-Hub-Signature-256` header) against the app secret before processing.
- Map the Meta status to the `DeliveryStatus` enum and update the matching `MessageLog`.
- QR-session delivery acks are handled in Task 6 (Baileys `messages.update` events) and converge on the same `handleDeliveryStatus`.

- [ ] **Step 1:** Implement `handleDeliveryStatus`.
- [ ] **Step 2:** Implement the webhook route with signature verification (Meta `verify_token` handshake + HMAC).
- [ ] **Step 3:** Write unit tests for signature verification (valid, tampered, missing header) and status mapping.
- [ ] **Step 4:** Run `npm test` — expected PASS.
- [ ] **Step 5:** Commit.

---

## Definition of Done

- `npm test` and `npm run test:integration` both pass.
- A `Business` with `whatsappChannel = CLOUD_API` and valid credentials sends a rendered reminder via the Meta Cloud API and records a `MessageLog`.
- A due `ReminderJob` routed through the worker produces a `MessageLog` and is marked `SENT`; a `PAID` invoice is never resent.
- A `Business` with `whatsappChannel = NONE` skips dispatch and marks the reminder `SKIPPED`.
- The QR-session channel connects persistent Baileys sockets per number, surfaces an opt-in QR flow with the ToS warning, and sends via the socket.
- Cloud API delivery-status webhooks verify signatures and update `MessageLog` states; Baileys acks converge on the same handler.
- All tasks are committed as separate commits.