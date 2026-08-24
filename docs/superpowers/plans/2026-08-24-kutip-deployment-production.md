# Kutip Deployment & Production Launch Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the Kutip app from local development to a live, production-ready deployment on a single DigitalOcean droplet — including the Docker Compose production stack, Caddy reverse proxy + TLS, database backups, secrets management, and the remaining hardening steps — so the full Phase 1 loop (generate → deliver → collect → reconcile) runs for real merchants.

**Architecture:** A single DigitalOcean droplet running a Docker Compose monolith (Next.js app + Postgres + Redis + worker processes), fronted by Caddy for automatic TLS. This matches the PRD §8 architecture and keeps the QR-session socket model on one always-on VPS.

**Tech Stack:** Docker Compose (production overrides), Caddy, Postgres 16, Redis 7, Node 20 LTS, and the existing Next.js/Prisma/BullMQ app. External accounts required: DigitalOcean, Namecheap (domain), Clerk (production instance), Meta WhatsApp (production), ToyyibPay (production), and optionally Backblaze B2 for off-site backups.

**Spec:** [docs/Kutip-PRD.md](../../Kutip-PRD.md)

## Global Constraints

- Single VPS hosts app, DB, and workers (accepted for MVP; scaling path is future work) (§11).
- **Backups are a hard requirement, not optional** — this system stores billing/financial data; scheduled `pg_dump` to off-site storage is mandatory (§11).
- **Secrets never committed** — keys live in `.env` on the VPS (§11).
- **All inbound webhooks verify signatures** before acting (§11) — already implemented for WhatsApp and ToyyibPay.
- QR-session channel carries ToS risk and must remain opt-in (§11).
- Production uses `next start` (not `next dev`) and a production Clerk instance (not development keys).

---

### Task 1: Production Docker Compose setup

**Files:**
- Create: `docker-compose.prod.yml` (or `compose.override` for prod)
- Create: `Dockerfile` for the Next.js app
- Create: `.dockerignore`

**Interfaces:**
- Produces: a production Docker image running the Next.js app via `next start`.
- Produces: a production Compose stack wiring app + Postgres + Redis + the worker process.

**Steps:**
- [ ] **Step 1:** Write a multi-stage `Dockerfile` that installs deps, generates the Prisma client, builds the app, and runs `next start` with Node 20.
- [ ] **Step 2:** Write `docker-compose.prod.yml` with:
  - `app` service (built from `Dockerfile`, exposed on an internal port)
  - `postgres` + `redis` with persistent named volumes
  - `worker` service running `npm run workers` (the BullMQ consumers + QR sockets)
  - a `caddy` service (Task 2)
- [ ] **Step 3:** Write `.dockerignore` excluding `node_modules`, `.next`, `.git`, `.env*` (except `.env.example`).
- [ ] **Step 4:** Add an npm script `"start:prod": "next start"` if not present.
- [ ] **Step 5:** Commit.

---

### Task 2: Caddy reverse proxy + TLS

**Files:**
- Create: `Caddyfile`
- Modify: `docker-compose.prod.yml` (add caddy service)

**Interfaces:**
- Produces: automatic HTTPS via Caddy + Let's Encrypt for the domain.
- Produces: reverse proxy routing to the Next.js app.

**Steps:**
- [ ] **Step 1:** Write a `Caddyfile` that proxies `yourdomain.com` → the `app` service, with automatic TLS.
- [ ] **Step 2:** Add the `caddy` service to the prod Compose file, mounting the `Caddyfile` and a persistent volume for certificates.
- [ ] **Step 3:** Document that the domain's A record must point at the droplet's IP.
- [ ] **Step 4:** Commit.

---

### Task 3: Production environment & secrets

**Files:**
- Create: `.env.production.example` (template)
- Modify: `.gitignore` (ensure `.env.production` is ignored)

**Interfaces:**
- Produces: a documented production env template listing every required variable and its source.
- Produces: confirmation that secrets are gitignored.

**Steps:**
- [ ] **Step 1:** Write `.env.production.example` with:
  - `DATABASE_URL`, `REDIS_URL` (container-internal hosts)
  - `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (production instance)
  - `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_WEBHOOK_SECRET`
  - `NEXT_PUBLIC_BASE_URL` (the live domain)
  - `QR_AUTH_DIR`
- [ ] **Step 2:** Confirm `.env.production` is in `.gitignore`.
- [ ] **Step 3:** Commit.

---

### Task 4: Database backups (hard requirement)

**Files:**
- Create: `scripts/backup.sh` (or `scripts/backup.ps1`)
- Create: `scripts/restore.sh`
- Modify: `docker-compose.prod.yml` (optional backup cron sidecar)

**Interfaces:**
- Produces: a scheduled `pg_dump` to off-site storage (DigitalOcean Spaces, S3-compatible).
- Produces: a documented restore procedure.

**Steps:**
- [ ] **Step 1:** Write a backup script that runs `pg_dump` and uploads to a DigitalOcean Spaces bucket (using `rclone` or `awscli` against the Spaces S3-compatible endpoint).
- [ ] **Step 2:** Schedule it via cron (daily, retaining N days).
- [ ] **Step 3:** Write and **test** the restore script against a fresh container.
- [ ] **Step 4:** Document the runbook.
- [ ] **Step 5:** Commit.

---

### Task 5: Production Clerk instance

**Steps (mostly manual — requires the Clerk dashboard):**
- [ ] **Step 1:** Create/switch the Clerk app to a **production** instance.
- [ ] **Step 2:** Enable **Organizations** on production (repeat of the dev step).
- [ ] **Step 3:** Copy production keys into `.env.production`.
- [ ] **Step 4:** Configure production OAuth redirect/sign-in URLs to the live domain.
- [ ] **Step 5:** Verify signup works against the live domain.

---

### Task 6: Production WhatsApp + ToyyibPay

**Steps (manual, per external account):**
- [ ] **Step 1:** Move the Meta WhatsApp app to production, register an approved message template, and set the webhook URL to `https://yourdomain.com/api/whatsapp/webhook`.
- [ ] **Step 2:** Switch ToyyibPay to live (`toyyibpaySandbox = false`), set the callback URL to `https://yourdomain.com/api/payments/toyyibpay/webhook`.
- [ ] **Step 3:** Verify both webhooks pass signature verification end-to-end.

---

### Task 7: Hardening & monitoring

**Files:**
- Create: `scripts/healthcheck.sh` (optional)

**Steps:**
- [ ] **Step 1:** Confirm webhook signature verification is active in production (already implemented).
- [ ] **Step 2:** Add basic health-check endpoints or UptimeRobot/Render monitor pings.
- [ ] **Step 3:** Review Docker restart policies (`unless-stopped`) for resilience.
- [ ] **Step 4:** Document the single-point-of-failure scaling path (future work).

---

## Definition of Done

- `docker compose -f docker-compose.prod.yml up -d` starts the full production stack on the droplet.
- The app is reachable over HTTPS at the live domain via Caddy.
- Production Clerk, WhatsApp, and ToyyibPay are configured with live credentials and correct webhook URLs.
- Daily `pg_dump` backups run to off-site storage, and the restore procedure is tested.
- All webhooks verify signatures; secrets are never committed.
- The full Phase 1 loop (invoice → WhatsApp reminder → payment → reconcile → receipt) works in production.

## Open questions / decisions for the user

- Domain name choice (Namecheap free 1-year domain via GitHub Student Developer Pack).
- Backup storage provider: **DigitalOcean Spaces** (S3-compatible), using the GitHub Student Developer Pack's DigitalOcean credit — same provider as the droplet, same credit pool. `scripts/backup.sh` uses `rclone` (or `awscli` with the S3-compatible endpoint) against a Spaces bucket.
- Stripe / plan-tier billing: **deferred**. This plan does not include merchant subscription billing — the app remains free-to-use for now. Revisit as a separate future plan once the core loop is validated with real merchants.