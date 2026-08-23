# PRD — Kutip

*(formerly "AutoBill & WhatsApp Notification Hub")*

**Status:** Draft for review
**Author:** Raziq Shafiee (with Claude)
**Date:** 2026-08-23
**Market:** Malaysia-first (MYR)
**Tagline:** Never chase a payment again — bills that collect themselves, on WhatsApp.

---

## 1. Problem Statement

Micro-businesses that bill recurring fees — tuition centers, personal trainers, daycares, music instructors, long-term rental hosts — run collections manually: spreadsheets, calendar alarms, and copy-pasted WhatsApp reminders. This causes late payments, missed invoices, and hours of admin work every month, with no visibility into who owes what or who's at risk of defaulting.

## 2. Product Vision

A multi-tenant SaaS that automates the full billing lifecycle for micro-businesses: generate recurring invoices, deliver them directly into the client's WhatsApp chat, collect payment through a branded mobile checkout page, and auto-reconcile the moment payment lands — with escalating reminders handling the chasing automatically.

## 3. Goals & Success Metrics

| Goal | Metric |
|---|---|
| Eliminate manual invoice creation | % of invoices auto-generated vs. manually created |
| Reduce late payments | Median days-to-payment before vs. after adoption |
| Drive WhatsApp as primary delivery channel | % of invoices delivered via WhatsApp vs. other channels |
| Prove monetization | Free → Basic/Pro conversion rate |
| Retain merchants | Month-2 retention of paying tenants |

## 4. Target Users

**Primary — Business Owner (tenant admin):** Solo or small-team operator of a recurring-billing service business. Not technical; wants to configure once and forget. Price-sensitive, trusts WhatsApp far more than email.

**Secondary — End Customer:** The business owner's client, who receives bills and pays them. Never logs into a dashboard — interacts only via WhatsApp message and a lightweight payment page.

## 5. Scope

### Phase 1 (MVP) — full loop, ship together
Per your decision, Phase 1 ships the complete loop rather than a manual-tracking-first slice:

- Multi-tenant business portal (signup, business profile, client roster, billing rules)
- Automation engine: midnight cron sweep, invoice state machine, escalating reminders (T-3 / T0 / T+3 / T+7)
- WhatsApp dispatch layer — **both channels available from day 1**:
  - Official Meta WhatsApp Cloud API (default, reliable, ToS-safe)
  - QR-session gateway via WhatsApp Web protocol (opt-in "bootstrapping" channel for cost-sensitive merchants — see §11 Risks)
- Payment processing via **ToyyibPay** (FPX + e-wallet), webhook-driven auto-reconciliation
- PDF invoice/receipt generation
- Branded public invoice & payment pages
- Live financial pipeline dashboard (expected / collected / pending / default risk)

### Explicitly deferred (post-MVP)
- Multi-gateway routing (Billplz, Stripe, LemonSqueezy) — Pro tier
- Custom logo/branding on PDFs — Basic+/Pro tier
- Full accounting & tax export — Pro tier
- CSV bulk import polish, monthly summary reports — Basic tier follow-up
- Delivery-status engagement analytics (sent/delivered/read) beyond basic logging

## 6. Feature Matrix (by plan)

| Feature | Free (≤10 clients) | Basic (≤50 clients) | Pro (unlimited) |
|---|---|---|---|
| Monthly auto-invoicing | Yes | Yes | Yes |
| WhatsApp notifications | Manual 1-click launch | Automated scheduled cron | Automated multi-step escalation |
| PDF invoices & receipts | Standard template | Standard template | Custom logo & branding |
| Payment gateway | Manual bank transfer / QR | Direct FPX & card (ToyyibPay) | Multi-gateway & webhook routing |
| Data export & reporting | Basic CSV | Monthly summary reports | Full accounting & tax export |

## 7. User Journeys

**Business Owner:**
1. Signs up via Clerk, creates a business (org), sets brand name/logo.
2. Connects a WhatsApp channel — enters Cloud API credentials, or scans a QR code to link their own number.
3. Adds clients individually or via CSV import (name, E.164 phone, service tier, amount, billing cycle day).
4. Configures billing rules (frequency, grace period, late fees) per client or globally.
5. Selects a plan (Free by default; upgrades via Stripe for Basic/Pro).
6. From here, the system runs autonomously — the owner checks the dashboard for cash-flow visibility only.

**End Customer:**
1. Receives a WhatsApp message with the invoice summary and a payment link, sent by the business's official template or the business's own number (QR channel).
2. Taps the link → mobile-optimized payment page showing the breakdown.
3. Pays via FPX, card, or e-wallet through ToyyibPay checkout.
4. Immediately receives a WhatsApp "Payment Received — Thank You!" message with a downloadable PDF receipt.

## 8. System Architecture

**Deployment: single DigitalOcean droplet (GitHub Student Pack $200 credit), Docker Compose monolith.** No serverless split — the QR-session WhatsApp channel requires a persistent, always-on socket connection per business number, which is a poor fit for serverless functions; running everything on one always-on VPS keeps the architecture simple and avoids splitting state across two hosting environments.

```
┌─────────────────────────────────────────────────────────┐
│                    DigitalOcean Droplet                  │
│                                                           │
│  Caddy (reverse proxy + auto TLS, free Namecheap domain) │
│         │                                                │
│  ┌──────▼────────┐   ┌─────────────┐   ┌──────────────┐  │
│  │  Next.js app  │   │  Postgres   │   │    Redis     │  │
│  │ (dashboard +  │◄─►│ (tenant DB, │   │  (BullMQ     │  │
│  │  API routes + │   │  shared     │   │   job queue) │  │
│  │  public pages)│   │  schema)    │   │              │  │
│  └──────┬────────┘   └─────────────┘   └──────┬───────┘  │
│         │                                      │          │
│  ┌──────▼─────────────────────────────────────▼───────┐  │
│  │           Worker processes (BullMQ consumers)       │  │
│  │  • Midnight cron sweep (invoice generation)          │  │
│  │  • Reminder scheduler (T-3/T0/T+3/T+7)                │  │
│  │  • WhatsApp Cloud API sender (HTTP, stateless)        │  │
│  │  • WhatsApp QR-session worker (Baileys, one           │  │
│  │    persistent socket per connected business number,   │  │
│  │    session files on a persisted volume)                │  │
│  │  • PDF generator (invoice/receipt render)              │  │
│  │  • Payment webhook processor (ToyyibPay)                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Multi-tenancy:** single Postgres database, shared schema, every table scoped by `tenant_id` (business ID). Clerk Organizations map 1:1 to business tenants; the org's admin is the business owner.

## 9. Core Data Model (high level)

- **Business** (tenant): brand name, logo, plan, WhatsApp channel config, gateway credentials
- **Client**: name, E.164 phone, service tier, billing amount, `billingCycleDay`
- **BillingRule**: frequency (monthly/quarterly/custom), grace period, late-fee policy
- **Invoice**: state machine `DRAFT → ISSUED → PAID / OVERDUE → ARCHIVED`, due date, amount, PDF ref
- **Payment**: gateway transaction ref, amount, timestamp, linked invoice
- **ReminderJob**: invoice ref, scheduled date (T-3/T0/T+3/T+7), status
- **MessageLog**: channel used, template, delivery status (sent/delivered/read/failed)

## 10. Core Workflows

**Midnight cron sweep:** daily job scans all clients for `billingCycleDay` matches → generates `DRAFT → ISSUED` invoices with computed due dates → enqueues T-3/T0 reminder jobs.

**Reminder dispatch:** BullMQ worker picks up due reminder jobs → renders the WhatsApp template with dynamic variables (`{{client_name}}`, `{{amount}}`, `{{service_name}}`, `{{payment_link}}`) → sends via the business's configured channel → logs delivery status (webhook for Cloud API, ack event for QR/Baileys). T+3/T+7 jobs only fire if the invoice is still `PENDING`.

**Payment & reconciliation:** customer pays on the public invoice page via ToyyibPay → gateway webhook hits a signed endpoint → signature verified → invoice flipped to `PAID` → PDF receipt generated (headless render) → WhatsApp confirmation message with receipt enqueued.

## 11. Non-Functional Requirements & Risks

- **WhatsApp ToS risk (QR channel):** the QR-session gateway uses the unofficial WhatsApp Web protocol, which violates WhatsApp's Terms of Service and carries a real risk of the business's number being banned. This must be presented to merchants as an explicit opt-in with a clear warning, not a default.
- **Single point of failure:** one VPS hosts app, DB, and workers. Acceptable for MVP; documented scaling path (managed Postgres, multi-instance workers) is future work, not Phase 1 scope.
- **Backups:** scheduled `pg_dump` to off-site storage (e.g. Backblaze B2 or S3-compatible) is a hard requirement, not optional — this system stores billing/financial data.
- **Secrets management:** payment gateway keys, WhatsApp Cloud API tokens, and Clerk keys live in `.env` on the VPS, never committed to the repo.
- **Webhook security:** all inbound webhooks (payment gateway, WhatsApp) must verify signatures before acting.

## 12. Tech Stack

- **Framework:** Next.js (App Router), self-hosted via `next start`
- **Auth:** Clerk (Organizations = tenants)
- **Database:** self-hosted Postgres (Docker container on the droplet)
- **Queue:** Redis + BullMQ
- **WhatsApp:** Meta WhatsApp Cloud API (official) + Baileys (QR-session)
- **Payments:** ToyyibPay (Phase 1); architecture leaves room for Billplz/Stripe later
- **Hosting:** DigitalOcean droplet (GitHub Student Pack credit), Docker Compose, Caddy reverse proxy
- **Domain:** free 1-year domain via Namecheap (GitHub Student Pack)
- **Billing (subscription plans):** Stripe, for Free→Basic/Pro upgrades

## 13. Open Questions

- Exact late-fee policy defaults (flat fee vs. % of invoice)?
- Should QR-session channel be capped to Free/Basic tiers only, given its risk profile?
- CSV import format/validation rules for bulk client upload?
- Namecheap domain name choice — pending product name finalized below.

## 14. Milestone Roadmap (indicative)

1. **Foundation:** VPS provisioning, Docker Compose stack, Clerk auth, tenant/client data model
2. **Invoicing core:** billing rules, cron sweep, invoice state machine, PDF generation
3. **WhatsApp dispatch:** Cloud API integration + templates; QR-session worker (Baileys)
4. **Payments:** ToyyibPay checkout + webhook reconciliation + receipt dispatch
5. **Dashboard:** financial pipeline metrics, plan tiers, Stripe subscription upgrade
6. **Hardening:** backups, webhook signature verification, ToS risk warnings, launch
