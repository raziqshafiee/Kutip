# Design — Client & Billing Rule Management UI

**Status:** Approved
**Date:** 2026-08-24
**Author:** Raziq Shafiee (with Claude)
**Spec:** [docs/Kutip-PRD.md](../../Kutip-PRD.md)

## Problem

Kutip's automation loop (foundation → invoicing core → WhatsApp dispatch →
payments) is fully built, but there is no way for a business owner to create
a client. The `Client` model exists in Prisma and the invoice generator reads
it, but the only way a row gets created today is a direct database write. The
PRD's Business Owner journey (§7, step 3: "Adds clients individually...")
requires a client roster page before the product is usable by a real
merchant.

`BillingRule` has the same gap, but it is not blocking: `buildInvoiceForClient`
(`src/lib/invoice/generator.ts`) already falls back to `MONTHLY` frequency and
a 0-day grace period when no `BillingRule` row exists for the tenant. Adding a
config page for it is a should-have, not a must-have, for this plan.

## Goals

- A business owner can list, add, edit, and delete clients from the dashboard.
- A business owner can view and edit their billing policy (frequency, grace
  period, late fee) from the dashboard.
- Both surfaces are tenant-scoped, following the existing `tenantId` pattern
  used everywhere else in the codebase.

## Non-goals (explicitly deferred)

- CSV bulk import (PRD already lists this as post-MVP polish).
- Business brand name / logo fields.
- WhatsApp QR-session pairing UI (currently prints to the server terminal via
  `printQRInTerminal: true` in `qrWorker.ts`).
- Stripe subscription billing / plan tiers.

These remain real gaps against the PRD but are out of scope here to keep this
plan focused; each is a candidate for its own future plan.

## Schema change

`BillingRule.tenantId` currently has no uniqueness constraint, so
`buildInvoiceForClient` picks an arbitrary row via `findFirst` if more than
one ever existed. The intent has always been one billing policy per business
(the foundation plan's schema comment says as much). This plan adds
`@unique` to `BillingRule.tenantId` and a Prisma migration, then switches the
new billing-rule form's write path to `prisma.billingRule.upsert()` (same
create-or-update shape as `getOrCreateTenantForOrg` in `src/lib/tenant.ts`).

`generator.ts`'s `findFirst` continues to work unchanged after the migration
(a unique column is still a valid `findFirst` target) — no other call site
needs to change.

## Pages & routes

All new routes live under `src/app/dashboard/`, following the existing
`src/app/dashboard/settings/` structure (a `page.tsx` server component that
loads tenant-scoped data, rendering a `'use client'` form component that
calls an imported server action).

- **`/dashboard/clients`** — roster table: name, phone (E.164), service tier,
  billing amount, billing cycle day, and Edit/Delete actions per row. An "Add
  client" button links to the new-client form.
- **`/dashboard/clients/new`** — form to create a client. Fields: name,
  phone (validated with the existing `isValidE164` from `src/lib/phone.ts`),
  service tier (optional free text, unchanged from the current schema),
  billing amount, billing cycle day (1–31).
- **`/dashboard/clients/[clientId]/edit`** — same form, pre-filled, submitting
  an update instead of a create.
- **`/dashboard/billing-rules`** — a single form (not a list, since there is
  now exactly one `BillingRule` row per tenant): frequency (Monthly /
  Quarterly / Custom), grace period (days), late fee amount (optional).

**Nav:** add "Clients" and "Billing Rules" links next to the existing
"Settings" link on `src/app/dashboard/page.tsx`.

## Server actions / service layer

New service module `src/lib/clients/service.ts`:
- `createClient(tenantId, input)` — validates phone via `isValidE164`,
  inserts.
- `updateClient(tenantId, clientId, input)` — validates phone, updates.
- `deleteClient(tenantId, clientId)` — **delete guard**: counts
  `prisma.invoice.count({ where: { clientId } })`; if greater than zero,
  returns a rejection (`{ ok: false, error: 'client has billing history — cannot delete' }`)
  instead of deleting. If zero, hard-deletes the row. All queries scoped by
  `tenantId` so one tenant can never touch another tenant's client (mirrors
  the existing tenant-scoping pattern proven in
  `tenant-scoping.integration.test.ts`).
- `listClients(tenantId)` — tenant-scoped fetch for the roster page.

New service module `src/lib/billing/service.ts`:
- `upsertBillingRule(tenantId, input)` — wraps
  `prisma.billingRule.upsert({ where: { tenantId }, update: ..., create: ... })`.
- `getBillingRule(tenantId)` — tenant-scoped fetch for the form's initial
  values (returns `null` if none exists yet, matching the generator's
  fallback-to-defaults behavior).

Both modules are plain async functions imported directly into `'use client'`
form components as server actions — the same shape as
`src/lib/settings/updateBusiness.ts`.

## Error handling

- Invalid phone format → form-level validation error, same UX pattern as
  `settings-form.tsx`'s status message (`{ ok: false, message: string }`).
- Delete blocked by existing invoices → surfaced as a form/action error, not
  a silent no-op or a 500.
- All service functions scope every query by `tenantId` — no cross-tenant
  reads or writes are possible even with a malformed client ID.

## Testing

TDD, matching existing repo conventions:
- Unit tests for validation and the delete-guard logic (e.g.
  `src/lib/__tests__/clients-service.unit.test.ts`).
- Integration tests against the real test Postgres database for tenant-scoped
  CRUD correctness (e.g. `src/lib/__tests__/clients-service.integration.test.ts`,
  `src/lib/__tests__/billing-service.integration.test.ts`), following the
  style of `tenant-scoping.integration.test.ts`.

## Definition of Done

- A business owner can add, edit, list, and delete clients from
  `/dashboard/clients` without touching the database directly.
- A business owner can view and edit their billing policy from
  `/dashboard/billing-rules`.
- `BillingRule.tenantId` is unique at the schema level; the migration has
  been applied to both the dev and test databases.
- Deleting a client with existing invoices is blocked with a clear error.
- `npm test` and `npm run test:integration` both pass.
