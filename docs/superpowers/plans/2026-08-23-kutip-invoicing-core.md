# Kutip Invoicing Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the recurring-invoice generation engine: a BullMQ-driven midnight cron sweep that scans clients for their `billingCycleDay`, generates `DRAFT → ISSUED` invoices with computed due dates, enqueues escalating reminder jobs (T-3 / T0 / T+3 / T+7), and renders PDF invoices/receipts. WhatsApp dispatch and payments are separate plans that consume this engine's output.

**Architecture:** A BullMQ job queue backed by the Redis already provisioned in the Foundation plan. The Invoicing Core runs inside the same Next.js monolith via worker processes (repeated jobs + a persistent worker process). Every tenant-owned row stays scoped by `tenantId`.

**Tech Stack:** Next.js (App Router, TypeScript), Prisma + PostgreSQL, Redis + BullMQ, Vitest. The schema from the Foundation plan is the source of truth and must not be changed unless this plan explicitly says so.

**Spec:** [docs/Kutip-PRD.md](../../Kutip-PRD.md)

## Global Constraints

- Market is Malaysia-first (MYR); money values are stored as `Decimal(10,2)` (spec §5, §9).
- Multi-tenancy: single shared Postgres schema, every tenant-owned table scoped by `tenantId` (business ID) (spec §8, §9).
- Invoice state machine is `DRAFT → ISSUED → PAID / OVERDUE → ARCHIVED` (spec §9, §10).
- Midnight cron sweep runs once per day, scanning all clients for `billingCycleDay` matches, generating invoices and enqueuing T-3/T0 reminder jobs (spec §10).
- T+3/T+7 reminder jobs only fire if the invoice is still `PENDING` (spec §10).
- Secrets live in `.env`, never committed (spec §11).
- Queue is Redis + BullMQ (spec §12); Redis is already running from the Foundation plan.
- **Scope boundary:** WhatsApp *sending* (Cloud API / QR-session) and payment *collection* (ToyyibPay) are OUT of scope here — this plan produces the invoice records, the scheduled reminder jobs, and the PDF artifacts. The WhatsApp Dispatch plan and Payments plan consume them.

---

### Task 1: Install BullMQ and define the queue/worker harness

**Files:**
- Install: `bullmq`, `ioredis`
- Create: `src/lib/queue.ts`
- Create: `src/lib/invoice/definitions.ts`
- Test: `src/lib/__tests__/queue.unit.test.ts`

**Interfaces:**
- Produces: a configured BullMQ `Queue` and `Worker` factory bound to `REDIS_URL`.
- Produces: typed job names and payloads for `invoice.generate` and `reminder.dispatch` that later tasks and plans reference.

**Steps:**

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install bullmq ioredis
```

- [ ] **Step 2: Create the shared queue module**

Create `src/lib/queue.ts`:

```ts
import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'

export const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export function createQueue<T>(name: string) {
  return new Queue<T>(name, { connection })
}

export function createWorker<T>(name: string, processor: (job: { data: T }) => Promise<void>) {
  return new Worker(name, processor, { connection })
}
```

- [ ] **Step 3: Define job contracts**

Create `src/lib/invoice/definitions.ts`:

```ts
export const INVOICE_QUEUE = 'invoices'
export const REMINDER_QUEUE = 'reminders'

export type InvoiceGenerateJob = {
  tenantId: string
  referenceDate: string // ISO date (YYYY-MM-DD) of the sweep
}

export type ReminderDispatchJob = {
  invoiceId: string
  stage: 'T_MINUS_3' | 'T_0' | 'T_PLUS_3' | 'T_PLUS_7'
}
```

- [ ] **Step 4: Write a unit test for queue wiring**

Create `src/lib/__tests__/queue.unit.test.ts` verifying the two job names and payload shapes are importable and typed.

- [ ] **Step 5: Run the unit tests**

Run: `npm test` — expected PASS (unit-only, no Redis required at test time beyond construction).

- [ ] **Step 6: Commit**

```bash
git add src/lib/queue.ts src/lib/invoice/definitions.ts src/lib/__tests__/queue.unit.test.ts package.json package-lock.json
git commit -m "feat: add BullMQ queue harness and job definitions"
```

---

### Task 2: Invoice generation — billing-cycle match and amount computation

**Files:**
- Create: `src/lib/invoice/generator.ts`
- Test: `src/lib/__tests__/invoice-generator.unit.test.ts`
- Test: `src/lib/__tests__/invoice-generator.integration.test.ts`

**Interfaces:**
- Produces: `computeBillingDueDate(cycleDay, frequency, anchorDate): Date` — pure function for due-date math.
- Produces: `findClientsDueForBilling(tenantId, referenceDate): Promise<Client[]>` — clients whose `billingCycleDay` matches the reference day.
- Produces: `buildInvoiceForClient(client, referenceDate): { amount, dueDate }` — applies `billingAmount` and the business's billing rule.

**Logic to implement:**
- A client is due when its `billingCycleDay` equals the reference date's day-of-month, capped to the last day of the month (e.g., cycle day 31 in a 30-day month → day 30).
- `dueDate` is computed from `billingCycleDay` on the target month plus the `BillingRule.gracePeriodDays`.
- `amount` defaults to `client.billingAmount`; a `BillingRule.lateFeeAmount` is NOT applied at generation (only at overdue transition, Task 4).

- [ ] **Step 1: Implement the pure due-date helper** with day-of-month capping and month arithmetic.
- [ ] **Step 2: Implement `findClientsDueForBilling`** querying `Client` filtered by `tenantId` and `billingCycleDay === day`, then matching against the month length.
- [ ] **Step 3: Implement `buildInvoiceForClient`** producing `{ amount, dueDate }`.
- [ ] **Step 4: Write unit tests** for the pure functions (month boundary cases, cycle day > days in month, leap-year February).
- [ ] **Step 5: Write integration tests** against `kutip_test` creating two tenants with distinct cycle days and asserting only the due client is selected.
- [ ] **Step 6: Run `npm run test:integration`** — expected PASS.
- [ ] **Step 7: Commit.**

---

### Task 3: Invoice persistence and state machine

**Files:**
- Create: `src/lib/invoice/service.ts`
- Test: `src/lib/__tests__/invoice-service.unit.test.ts`
- Test: `src/lib/__tests__/invoice-service.integration.test.ts`

**Interfaces:**
- Produces: `createInvoiceForClient(client, { amount, dueDate }): Promise<Invoice>` — creates the invoice in `DRAFT` then flips to `ISSUED`.
- Produces: `transitionInvoice(invoiceId, toStatus): Promise<Invoice>` — enforces legal transitions.
- Produces: `markOverdue(invoiceId): Promise<Invoice>` — used by the overdue sweep (Task 4).

**State machine (enforce):**
```
DRAFT → ISSUED
ISSUED → PAID
ISSUED → OVERDUE
ISSUED → ARCHIVED
OVERDUE → PAID
OVERDUE → ARCHIVED
```
Any other transition throws an error.

- [ ] **Step 1: Implement `createInvoiceForClient`** with `DRAFT → ISSUED` and a unique `tenantId`-scoped index on `(clientId, dueDate)` to prevent duplicate monthly invoices.
- [ ] **Step 2: Implement `transitionInvoice`** with the legal-transition map above; reject illegal transitions.
- [ ] **Step 3: Implement `markOverdue`** that only fires when due date + grace period has passed and status is `ISSUED`.
- [ ] **Step 4: Write unit tests** for the transition map (legal + illegal transitions).
- [ ] **Step 5: Write integration tests** asserting an invoice is created `ISSUED` and transitions enforce the map against the real DB.
- [ ] **Step 6: Run `npm run test:integration`** — expected PASS.
- [ ] **Step 7: Commit.**

---

### Task 4: Midnight cron sweep and overdue sweep

**Files:**
- Create: `src/lib/invoice/sweep.ts`
- Test: `src/lib/__tests__/invoice-sweep.integration.test.ts`

**Interfaces:**
- Produces: `runDailySweep(referenceDate): Promise<{ invoicesCreated: number }>` — the cron body.
- Produces: `runOverdueSweep(): Promise<{ markedOverdue: number }>` — flips due+grace-passed `ISSUED` invoices to `OVERDUE`.

**Workflow:**
- `runDailySweep`: for every tenant, find clients due (Task 2), create `ISSUED` invoices (Task 3), and enqueue `T_MINUS_3` + `T_0` reminder jobs (Task 5).
- `runOverdueSweep`: mark overdue invoices per the rule above.

- [ ] **Step 1: Implement `runDailySweep`** iterating tenants, delegating to Task 2/3 helpers, enqueuing reminder jobs.
- [ ] **Step 2: Implement `runOverdueSweep`.**
- [ ] **Step 3: Write integration tests** that run `runDailySweep` with a seeded reference date and assert invoices are created and reminder jobs are enqueued.
- [ ] **Step 4: Run `npm run test:integration`** — expected PASS.
- [ ] **Step 5: Commit.**

---

### Task 5: Reminder job scheduling (T-3 / T0 / T+3 / T+7)

**Files:**
- Create: `src/lib/invoice/reminders.ts`
- Test: `src/lib/__tests__/invoice-reminders.integration.test.ts`

**Interfaces:**
- Produces: `scheduleInvoiceReminders(invoice, referenceDate): Promise<ReminderJob[]>` — creates `ReminderJob` rows for the appropriate stages.
- Produces: `scheduleFollowUpReminders(invoiceId): Promise<void>` — enqueues T+3/T+7 only if the invoice is still unpaid (status `ISSUED` or `OVERDUE`, not `PAID`).

**Rules (spec §10):**
- At generation: enqueue `T_MINUS_3` (3 days before due) and `T_0` (due date).
- After due: enqueue `T_PLUS_3` and `T_PLUS_7` **only if** the invoice is still unpaid.
- A `ReminderJob` records `stage`, `scheduledFor`, and `status = PENDING`.

- [ ] **Step 1: Implement `scheduleInvoiceReminders`** computing `scheduledFor` from `dueDate`.
- [ ] **Step 2: Implement `scheduleFollowUpReminders`** gated on unpaid status.
- [ ] **Step 3: Write integration tests** asserting stages/schedule times and that follow-ups are skipped once paid.
- [ ] **Step 4: Run `npm run test:integration`** — expected PASS.
- [ ] **Step 5: Commit.**

---

### Task 6: PDF invoice/receipt generation

**Files:**
- Create: `src/lib/invoice/pdf.ts`
- Test: `src/lib/__tests__/invoice-pdf.unit.test.ts`

**Interfaces:**
- Produces: `generateInvoicePdf(invoiceId): Promise<Buffer>` — returns a PDF buffer for an invoice.
- Produces: `generateReceiptPdf(paymentId): Promise<Buffer>` — returns a PDF buffer for a payment receipt.

**Approach:**
- Render a minimal branded HTML template (company name from `Business.name`, client name, amount in MYR, due date, line items) and convert to PDF using a pure-Next.js/Node headless render. Use a lightweight, dependency-light PDF generator that runs in the monolith (e.g. `@react-pdf/renderer` or an HTML-to-PDF approach). Prefer the simplest option that passes tests and does not require a browser binary.

- [ ] **Step 1: Install the chosen PDF library.**
- [ ] **Step 2: Implement `generateInvoicePdf`** with the template.
- [ ] **Step 3: Implement `generateReceiptPdf`.**
- [ ] **Step 4: Write a unit test** asserting the output is a non-empty Buffer and (optionally) starts with the PDF magic header `%PDF`.
- [ ] **Step 5: Run `npm test`** — expected PASS.
- [ ] **Step 6: Commit.**

---

### Task 7: Wire a scheduled cron trigger for the daily sweep

**Files:**
- Create: `src/lib/invoice/cron.ts`
- Create: `src/lib/invoice/worker.ts`

**Interfaces:**
- Produces: a repeatable BullMQ job `invoice.sweep.daily` on a cron schedule (e.g. midnight server-local) that calls `runDailySweep(new Date())`.
- Produces: a `startInvoicingWorkers()` entrypoint that registers the sweep worker and the reminder-dispatch worker placeholder.

- [ ] **Step 1: Implement the repeatable cron job** registration.
- [ ] **Step 2: Implement `startInvoicingWorkers()`** that wires the daily sweep worker and a placeholder reminder worker (actual WhatsApp dispatch lands in the WhatsApp Dispatch plan).
- [ ] **Step 3: Add an npm script** `"workers": "tsx src/lib/invoice/worker.ts"` (or the project's chosen TS runner) so a worker process can be started in dev.
- [ ] **Step 4: Smoke-test** the worker starts and connects to Redis without error.
- [ ] **Step 5: Commit.**

---

## Definition of Done

- `npm test` and `npm run test:integration` both pass.
- A seeded client with a matching `billingCycleDay` produces an `ISSUED` invoice with the correct `amount` and `dueDate` when `runDailySweep` runs.
- Duplicate monthly invoices are prevented per client.
- Reminder jobs are created for T-3/T0 at generation and T+3/T+7 only while unpaid.
- Overdue sweep flips past-due `ISSUED` invoices to `OVERDUE`.
- `generateInvoicePdf` and `generateReceiptPdf` return non-empty PDF buffers.
- The daily cron job is registered on the Redis-backed queue and the worker starts cleanly.
- All tasks are committed as separate commits on `feature/kutip-foundation` (or a new branch if the implementer prefers).