# Kutip Deployment & Production Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take Kutip from local development to a live, production-ready deployment on a single DigitalOcean droplet — Docker Compose production stack, Caddy reverse proxy with automatic TLS, database backups, secrets management, and hardening — so the full Phase 1 loop runs for real merchants.

**Architecture:** A single DigitalOcean droplet running a Docker Compose monolith: `app` (Next.js via `npm start`), `worker` (the same image running `npm run workers` — BullMQ consumers plus the Baileys QR-session sockets), `postgres`, `redis`, and `caddy` (reverse proxy + automatic TLS). All five services share one Docker network; only Caddy publishes ports to the host.

**Tech Stack:** Docker Compose, Caddy 2, Postgres 16, Redis 7, Node 20 (Alpine), the existing Next.js 16 / Prisma 7 / BullMQ / Baileys app. External accounts required: DigitalOcean (droplet), Namecheap (domain, GitHub Student Pack), Clerk (production instance), Meta WhatsApp (production), ToyyibPay (production), DigitalOcean Spaces (off-site backups, same account/credit as the droplet).

**Spec:** [docs/Kutip-PRD.md](../../Kutip-PRD.md) (§8 System Architecture, §11 Non-Functional Requirements, §12 Tech Stack). This plan has no separate design-spec document — it was scoped directly from the PRD; this header plus the PRD are the binding authority.

## Global Constraints

- Single VPS hosts app, DB, and workers (accepted for MVP; scaling path is future work, not in scope) (PRD §11).
- **Backups are a hard requirement** — scheduled `pg_dump` to DigitalOcean Spaces (off-site, S3-compatible), not optional (PRD §11; this plan's earlier decision record).
- **Secrets never committed** — all production values live in `.env.production` on the droplet, which is gitignored; only `.env.production.example` (no real values) is tracked (PRD §11).
- **All inbound webhooks verify signatures** before acting — already implemented in `src/app/api/whatsapp/webhook/route.ts` and `src/app/api/payments/toyyibpay/webhook/route.ts`; this plan does not change that code, only deploys it (PRD §11).
- QR-session WhatsApp channel carries ToS risk and must remain opt-in — already enforced in the Settings UI; not touched by this plan.
- Production uses `next start` (via `npm start`), never `next dev`, and a production Clerk instance, never development keys.
- Backup storage is **DigitalOcean Spaces** (S3-compatible), not Backblaze B2 — locked in because it shares the droplet's DigitalOcean account/credit.
- Stripe / plan-tier billing is out of scope for this plan (deferred to a future plan, per this plan's earlier decision record).

---

### Task 1: Production Dockerfile and Docker Compose stack

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docker-compose.prod.yml`

**Interfaces:**
- Consumes: `npm start` (`next start`, already in `package.json`) and `npm run workers` (`tsx src/lib/invoice/worker.ts`, already in `package.json`) as the two entrypoints the `app` and `worker` services run from the same built image.
- Produces: a `kutip-app` Docker image (built from `Dockerfile`) and a `docker-compose.prod.yml` stack with `postgres`, `redis`, `app`, `worker` services on one Docker network — Task 2 adds a `caddy` service to this same file; Task 4's backup script execs into the `postgres` service by name.

- [ ] **Step 1: Write `.dockerignore`**

Create `.dockerignore`:

```
node_modules
.next
.git
.env
.env.local
.env.test
.env.production
qr-sessions
coverage
*.log
.superpowers
docs
.agents
.claude
.windsurf
```

- [ ] **Step 2: Write the Dockerfile**

Create `Dockerfile`. This app's worker process runs TypeScript directly via `tsx` (no build step for the worker), so `tsx` and the full `node_modules` (not a pruned production-only set) stay in the runtime image — a slightly larger image is the accepted trade-off for a single-VPS MVP rather than a two-target build:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# Prisma's query engine needs openssl on Alpine.
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Only reads prisma/schema.prisma to generate the client -- no DB connection
# needed at build time.
RUN npx prisma generate

# None of Kutip's routes statically prerender data from the database (every
# dashboard/API page reads Clerk's auth() first, which forces dynamic
# rendering), so `next build` does not need a live DATABASE_URL.
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
```

- [ ] **Step 3: Verify the image builds**

Run: `docker build -t kutip-app .`
Expected: build completes successfully through all steps (`npm ci`, `prisma generate`, `npm run build`) with no errors, ending in `naming to docker.io/library/kutip-app`.

If the build fails at the `npm run build` step because Next.js attempts to statically render a page that touches the database, re-run with a placeholder connection string so Prisma's generated client has something to import against (this is not expected to be necessary):
`docker build --build-arg DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" -t kutip-app .`

- [ ] **Step 4: Write `docker-compose.prod.yml`**

Create `docker-compose.prod.yml`. `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` and `DATABASE_URL` are both read from `.env.production` (Task 3) — keep the credentials embedded in `DATABASE_URL` consistent with the standalone `POSTGRES_*` values, since Docker Compose does not cross-reference them automatically:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    env_file:
      - .env.production
    volumes:
      - kutip_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - kutip_redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - .env.production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    expose:
      - "3000"

  worker:
    build:
      context: .
      dockerfile: Dockerfile
    command: ["npm", "run", "workers"]
    restart: unless-stopped
    env_file:
      - .env.production
    environment:
      RUN_INVOICING_WORKERS: "1"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - kutip_qr_sessions:/app/qr-sessions

volumes:
  kutip_postgres_data:
  kutip_redis_data:
  kutip_qr_sessions:
```

Note: `${POSTGRES_USER}` in the `postgres` service's `healthcheck` is expanded by the **shell inside the container** at healthcheck-run time (from the environment `env_file` already injected), not by Docker Compose's own file-level variable substitution — no separate `.env` file or `--env-file` flag is needed for this to work.

`RUN_INVOICING_WORKERS=1` is required for `worker.ts`'s auto-start guard (`src/lib/invoice/worker.ts:33`) to actually call `startInvoicingWorkers()` when run via `tsx`.

- [ ] **Step 5: Verify the compose file is syntactically valid**

Docker Compose's `config` command requires every file referenced by an `env_file:` directive to physically exist on disk, even just to parse and validate the YAML — and it interpolates every `${VAR}` it finds anywhere in the file (including inside `healthcheck.test` array items), not only top-level `environment:` blocks. Since the real `.env.production` doesn't exist until a human deploys it (Task 3 only creates the tracked `.env.production.example` template), create a throwaway local stub first — it lands on the existing blanket `.env*` gitignore rule, so it never gets committed, and later tasks' compose-config checks can reuse it:

```bash
echo 'POSTGRES_USER=kutip' > .env.production
docker compose -f docker-compose.prod.yml config --quiet
```

Expected: no output and exit code 0.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile .dockerignore docker-compose.prod.yml
git commit -m "feat: add production Dockerfile and Docker Compose stack"
```

(Do not commit `.env.production` itself — it's gitignored and `git add` above only stages the three named files.)

---

### Task 2: Caddy reverse proxy with automatic TLS

**Files:**
- Create: `Caddyfile`
- Modify: `docker-compose.prod.yml`

**Interfaces:**
- Consumes: the `app` service from Task 1 (proxies to it by its Compose service name, `app:3000`).
- Produces: HTTPS termination for the domain defined by the `DOMAIN` variable in `.env.production` (Task 3).

- [ ] **Step 1: Write the Caddyfile**

Create `Caddyfile`:

```
{$DOMAIN} {
	reverse_proxy app:3000
}
```

Caddy resolves `{$DOMAIN}` from its own container's environment at startup — this is Caddy's built-in env-var substitution, independent of Docker Compose's file-level interpolation, so it works via the `env_file` mechanism already used elsewhere in this stack.

- [ ] **Step 2: Add the `caddy` service to `docker-compose.prod.yml`**

In `docker-compose.prod.yml`, add a `caddy` service and its two named volumes. Insert the service after `worker:` and before the `volumes:` top-level key:

```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    env_file:
      - .env.production
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app
```

Add `caddy_data:` and `caddy_config:` alongside the existing three volumes under the top-level `volumes:` key, so it reads:

```yaml
volumes:
  kutip_postgres_data:
  kutip_redis_data:
  kutip_qr_sessions:
  caddy_data:
  caddy_config:
```

The `app` service (Task 1) already uses `expose:` rather than `ports:`, so it stays unreachable from outside the Docker network — Caddy on 80/443 is the only public entry point.

- [ ] **Step 3: Verify the compose file is still valid**

Same caveat as Task 1 Step 5 — Compose requires the `env_file:`-referenced file to exist. A local `.env.production` stub should already exist from Task 1's verification (gitignored, untracked); if it doesn't (e.g. fresh checkout), recreate it first:

```bash
[ -f .env.production ] || echo 'POSTGRES_USER=kutip' > .env.production
docker compose -f docker-compose.prod.yml config --quiet
```

Expected: no output, exit code 0.

- [ ] **Step 4: Document the DNS requirement**

No code change — this is an operational note for whoever runs Step 5 on the real droplet: the domain's DNS **A record** must point at the droplet's public IP address before `docker compose up -d` starts Caddy, or Caddy's automatic Let's Encrypt certificate request will fail (Let's Encrypt validates ownership by reaching the domain over HTTP first).

- [ ] **Step 5: Commit**

```bash
git add Caddyfile docker-compose.prod.yml
git commit -m "feat: add Caddy reverse proxy with automatic TLS"
```

---

### Task 3: Production environment template

**Files:**
- Create: `.env.production.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `.env.production.example`, the documented template for every environment variable Tasks 1, 2, and 4 read via `env_file: .env.production` — a real `.env.production` (never committed) is copied from this template on the droplet before `docker compose -f docker-compose.prod.yml up -d` runs.

- [ ] **Step 1: Confirm `.env.production` is gitignored**

Check `.gitignore` — it already has a blanket `.env*` rule with `!.env.example` as the only carve-out (confirmed present: `.env*` / `!.env.example`). Add a second carve-out so `.env.production.example` is tracked the same way `.env.example` is:

```
.env*
!.env.example
!.env.production.example
```

- [ ] **Step 2: Write `.env.production.example`**

Create `.env.production.example`:

```
# Copy this file to `.env.production` on the droplet and fill in real values.
# .env.production is gitignored -- never commit it.

# --- Postgres (bootstraps the postgres container; must match the
# credentials embedded in DATABASE_URL below) ---
POSTGRES_USER="kutip"
POSTGRES_PASSWORD="CHANGE_ME_use_a_long_random_password"
POSTGRES_DB="kutip_prod"

# --- Database & Queue ---
# Container-internal hostnames: app/worker reach postgres/redis via their
# Docker Compose service names ("postgres", "redis"), never "localhost".
DATABASE_URL="postgresql://kutip:CHANGE_ME_use_a_long_random_password@postgres:5432/kutip_prod"
REDIS_URL="redis://redis:6379"

# --- Clerk (Authentication) -- PRODUCTION instance, not dev keys ---
CLERK_SECRET_KEY=""
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# --- WhatsApp Webhook (Meta Cloud API) -- PRODUCTION app ---
WHATSAPP_WEBHOOK_VERIFY_TOKEN=""
WHATSAPP_WEBHOOK_SECRET=""

# --- Base URL -- the live domain (must match DOMAIN below) ---
NEXT_PUBLIC_BASE_URL="https://yourdomain.com"

# --- QR-session auth directory (mounted as a persistent volume on the
# worker service) ---
QR_AUTH_DIR="/app/qr-sessions"

# --- Caddy reverse proxy ---
DOMAIN="yourdomain.com"

# --- Database backups (DigitalOcean Spaces, S3-compatible) ---
SPACES_ACCESS_KEY_ID=""
SPACES_SECRET_ACCESS_KEY=""
SPACES_ENDPOINT="https://nyc3.digitaloceanspaces.com"
SPACES_REGION="nyc3"
SPACES_BUCKET="kutip-backups"
BACKUP_RETENTION_DAYS="14"
```

- [ ] **Step 3: Verify every variable this plan's files reference is covered**

Run: `grep -oE '\$\{?[A-Z_]+\}?' docker-compose.prod.yml Caddyfile | tr -d '{}$' | sort -u`
Expected output (every name printed here must appear as a key in `.env.production.example` above):
```
DOMAIN
POSTGRES_USER
```

- [ ] **Step 4: Commit**

```bash
git add .env.production.example .gitignore
git commit -m "feat: add production environment template"
```

---

### Task 4: Database backups to DigitalOcean Spaces

**Files:**
- Create: `scripts/backup.sh`
- Create: `scripts/restore.sh`

**Interfaces:**
- Consumes: `docker-compose.prod.yml`'s `postgres` service (Task 1), `.env.production`'s `POSTGRES_USER`/`POSTGRES_DB`/`SPACES_*`/`BACKUP_RETENTION_DAYS` variables (Task 3).
- Produces: a `pg_dump`-based backup script uploading to DigitalOcean Spaces via `rclone`, and a matching restore script — both invoked manually or via cron on the droplet, no other task depends on their internals.

- [ ] **Step 1: Write `scripts/backup.sh`**

Create `scripts/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Run from the same directory as docker-compose.prod.yml and .env.production.
if [ -f .env.production ]; then
  set -a
  source .env.production
  set +a
fi

TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
BACKUP_FILE="kutip-backup-${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

echo "[backup] Dumping ${POSTGRES_DB}..."
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "/tmp/${BACKUP_FILE}"

export RCLONE_CONFIG_SPACES_TYPE=s3
export RCLONE_CONFIG_SPACES_PROVIDER=DigitalOcean
export RCLONE_CONFIG_SPACES_ACCESS_KEY_ID="${SPACES_ACCESS_KEY_ID}"
export RCLONE_CONFIG_SPACES_SECRET_ACCESS_KEY="${SPACES_SECRET_ACCESS_KEY}"
export RCLONE_CONFIG_SPACES_ENDPOINT="${SPACES_ENDPOINT}"
export RCLONE_CONFIG_SPACES_REGION="${SPACES_REGION}"

echo "[backup] Uploading to spaces:${SPACES_BUCKET}/backups/..."
rclone copy "/tmp/${BACKUP_FILE}" "spaces:${SPACES_BUCKET}/backups/"
rm "/tmp/${BACKUP_FILE}"

echo "[backup] Pruning backups older than ${RETENTION_DAYS} days..."
rclone delete "spaces:${SPACES_BUCKET}/backups/" --min-age "${RETENTION_DAYS}d"

echo "[backup] Done: ${BACKUP_FILE}"
```

- [ ] **Step 2: Make it executable and verify the dump pipeline against the local dev stack**

This validates the `pg_dump | gzip` half of the script (the part reachable without real DigitalOcean Spaces credentials) against the local dev Postgres already running via `docker-compose.yml` from the foundation plan:

```bash
chmod +x scripts/backup.sh scripts/restore.sh
docker compose exec -T postgres pg_dump -U kutip kutip_dev | gzip > /tmp/test-backup.sql.gz
gzip -t /tmp/test-backup.sql.gz && echo "OK: valid gzip archive"
rm /tmp/test-backup.sql.gz
```

Expected: `OK: valid gzip archive` printed, no errors. This confirms the `pg_dump`/`gzip` command shape `scripts/backup.sh` uses is correct; the `rclone`/Spaces-upload portion requires a real DigitalOcean Spaces bucket and cannot be exercised until one is provisioned (Step 5).

- [ ] **Step 3: Write `scripts/restore.sh`**

Create `scripts/restore.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <backup-filename>  (e.g. kutip-backup-20260824-030000.sql.gz)"
  echo "List available backups after sourcing .env.production:"
  echo "  rclone lsf spaces:\${SPACES_BUCKET}/backups/"
  exit 1
fi
BACKUP_FILE="$1"

if [ -f .env.production ]; then
  set -a
  source .env.production
  set +a
fi

export RCLONE_CONFIG_SPACES_TYPE=s3
export RCLONE_CONFIG_SPACES_PROVIDER=DigitalOcean
export RCLONE_CONFIG_SPACES_ACCESS_KEY_ID="${SPACES_ACCESS_KEY_ID}"
export RCLONE_CONFIG_SPACES_SECRET_ACCESS_KEY="${SPACES_SECRET_ACCESS_KEY}"
export RCLONE_CONFIG_SPACES_ENDPOINT="${SPACES_ENDPOINT}"
export RCLONE_CONFIG_SPACES_REGION="${SPACES_REGION}"

echo "[restore] Downloading ${BACKUP_FILE} from spaces:${SPACES_BUCKET}/backups/..."
rclone copy "spaces:${SPACES_BUCKET}/backups/${BACKUP_FILE}" /tmp/

echo "[restore] WARNING: this overwrites the current ${POSTGRES_DB} database."
read -r -p "Type 'restore' to continue: " CONFIRM
if [ "$CONFIRM" != "restore" ]; then
  echo "Aborted."
  exit 1
fi

gunzip -c "/tmp/${BACKUP_FILE}" | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "${POSTGRES_USER}" "${POSTGRES_DB}"
rm "/tmp/${BACKUP_FILE}"

echo "[restore] Done."
```

- [ ] **Step 4: Verify the restore pipeline's local half**

Symmetric to Step 2 — confirms `gunzip | psql` round-trips correctly against the local dev stack, without touching Spaces:

```bash
docker compose exec -T postgres pg_dump -U kutip kutip_dev | gzip > /tmp/test-backup.sql.gz
gunzip -c /tmp/test-backup.sql.gz | docker compose exec -T postgres psql -U kutip kutip_dev > /tmp/restore-output.log 2>&1
tail -5 /tmp/restore-output.log
rm /tmp/test-backup.sql.gz /tmp/restore-output.log
```

Expected: the tail shows normal `psql` statement output (e.g. `CREATE TABLE`, `ALTER TABLE`, `COPY N` lines) and no `ERROR:` lines. `psql` replaying a dump of a database against itself is expected to emit some "already exists" notices depending on dump mode — that's fine; only `ERROR:` lines indicate a real problem.

- [ ] **Step 5: Manual verification on the real droplet (post-provisioning)**

Once a DigitalOcean Spaces bucket exists and `.env.production`'s `SPACES_*` values are filled in on the droplet:

```bash
./scripts/backup.sh
rclone lsf spaces:${SPACES_BUCKET}/backups/
```

Expected: the backup file just created appears in the bucket listing. Then schedule it via cron (daily at 03:00 UTC, adjust as needed):

```bash
crontab -e
# add:
0 3 * * * cd /opt/kutip && ./scripts/backup.sh >> /var/log/kutip-backup.log 2>&1
```

- [ ] **Step 6: Commit**

```bash
git add scripts/backup.sh scripts/restore.sh
git commit -m "feat: add database backup and restore scripts for DigitalOcean Spaces"
```

---

### Task 5: Production Clerk instance (manual)

No files change in this repo for this task — it is entirely external account configuration, the same kind of "cannot be automated" step used in the foundation plan's Task 4.

- [ ] **Step 1:** Go to https://dashboard.clerk.com and create a new application (or switch the existing one to a **production** instance).
- [ ] **Step 2:** Under the Organizations settings tab, enable **Organizations** on the production instance (same toggle as development — it does not carry over automatically).
- [ ] **Step 3:** Copy the production `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (they start with `sk_live_...` / `pk_live_...`, not `sk_test_...` / `pk_test_...`) into `.env.production` on the droplet.
- [ ] **Step 4:** In the Clerk dashboard's production instance settings, set the allowed redirect/sign-in URLs to the live domain (`https://yourdomain.com`).
- [ ] **Step 5:** After `docker compose -f docker-compose.prod.yml up -d` is running (Task 1+2, on the droplet), visit `https://yourdomain.com/sign-up` and confirm a new account can be created and an Organization set up against the production Clerk instance.

---

### Task 6: Production WhatsApp Cloud API and ToyyibPay (manual)

No files change in this repo for this task — external account configuration only.

- [ ] **Step 1:** In the Meta for Developers dashboard, move the WhatsApp Business app from development to production/live mode, and register an approved message template for reminders (Meta requires template approval before automated messages can send).
- [ ] **Step 2:** Set the webhook URL to `https://yourdomain.com/api/whatsapp/webhook` and the verify token to match `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in `.env.production`.
- [ ] **Step 3:** In a merchant's Business Settings page (`/dashboard/settings`, already built), enter the production Cloud API Phone Number ID and Access Token — these are per-business, not global env vars, and are stored on the `Business` row.
- [ ] **Step 4:** In the ToyyibPay dashboard, switch to a live account; per-business `toyyibpaySandbox` is toggled off in that business's Settings page (already built), and its callback URL is `https://yourdomain.com/api/payments/toyyibpay/webhook`.
- [ ] **Step 5:** Verify both webhooks end-to-end: send a test WhatsApp reminder from a real invoice and confirm delivery-status updates arrive; complete a small real ToyyibPay payment and confirm the invoice flips to `PAID` and a receipt is dispatched.

---

### Task 7: Hardening and monitoring

**Files:**
- Create: `scripts/healthcheck.sh`

**Interfaces:**
- Consumes: the live `https://yourdomain.com` endpoint (via Caddy, Task 2).
- Produces: a standalone health-check script an external monitor (UptimeRobot, cron, etc.) can call; nothing else in this plan depends on it.

- [ ] **Step 1: Write `scripts/healthcheck.sh`**

Create `scripts/healthcheck.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://localhost}"
STATUS=$(curl -sk -o /dev/null -w "%{http_code}" "$URL")

if [ "$STATUS" -ge 200 ] && [ "$STATUS" -lt 400 ]; then
  echo "[healthcheck] OK ($STATUS) $URL"
  exit 0
else
  echo "[healthcheck] FAIL ($STATUS) $URL"
  exit 1
fi
```

- [ ] **Step 2: Verify it against the local dev server**

Run: `npm run dev &` then, once it's listening, `chmod +x scripts/healthcheck.sh && ./scripts/healthcheck.sh http://localhost:3000`
Expected: `[healthcheck] OK (200) http://localhost:3000`. Stop the dev server afterward (`kill %1` or close the terminal).

- [ ] **Step 3: Confirm restart policies**

No code change — verify by inspection that every service in `docker-compose.prod.yml` (Task 1 + Task 2) has `restart: unless-stopped` set: `postgres`, `redis`, `app`, `worker`, `caddy`. All five already do per Tasks 1-2's content above; this step is a final read-through, not a new edit.

- [ ] **Step 4: Document the scaling path (future work, not this plan's scope)**

No code change — note for the README or a future plan: the single-droplet architecture is a known single point of failure, accepted for MVP per the PRD. A future scaling pass would split into a managed Postgres instance, multiple app/worker replicas behind a load balancer, and a dedicated always-on host for the QR-session sockets (which cannot horizontally scale — each is a stateful per-business connection).

- [ ] **Step 5: Commit**

```bash
git add scripts/healthcheck.sh
git commit -m "feat: add health-check script and confirm restart policies"
```

---

## Definition of Done

- `docker compose -f docker-compose.prod.yml up -d` starts `postgres`, `redis`, `app`, `worker`, and `caddy`, all healthy.
- The app is reachable over HTTPS at the live domain via Caddy's automatic TLS.
- Production Clerk, WhatsApp Cloud API, and ToyyibPay are configured with live credentials and correct webhook URLs (Tasks 5-6).
- `scripts/backup.sh` successfully uploads a dump to DigitalOcean Spaces and is scheduled via cron; `scripts/restore.sh` has been exercised at least once against a real backup.
- All inbound webhooks verify signatures (already true in the application code; unchanged by this plan).
- No secrets are committed — `.env.production` exists only on the droplet, `.env.production.example` is the tracked template.
- The full Phase 1 loop (invoice → WhatsApp reminder → payment → reconcile → receipt) works against production accounts end-to-end (Task 6, Step 5).
