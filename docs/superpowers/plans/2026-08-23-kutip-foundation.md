# Kutip Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Kutip Next.js app with a multi-tenant data model and Clerk-based authentication, so every later subsystem (invoicing, WhatsApp dispatch, payments, dashboard) has a tenant, a client record, and a database to build on.

**Architecture:** A single Next.js (App Router, TypeScript) app backed by a self-hosted Postgres database (via Prisma) and Redis, all run locally through Docker Compose during development. Clerk Organizations map 1:1 to business tenants; every tenant-owned table carries a `tenantId` column.

**Tech Stack:** Next.js (App Router, TypeScript), Prisma + PostgreSQL, Redis, Clerk (`@clerk/nextjs`), Vitest, Docker Compose. Node.js 20 LTS or later assumed (not specified in the spec — adjust if your environment differs).

**Spec:** [docs/Kutip-PRD.md](../../Kutip-PRD.md)

## Global Constraints

- Market is Malaysia-first (MYR); client phone numbers are stored and validated in E.164 format (spec §5, §9).
- Multi-tenancy: single shared Postgres schema, every tenant-owned table scoped by `tenantId` (business ID) (spec §8, §9).
- Clerk Organizations map 1:1 to business tenants; the org's admin is the business owner (spec §8).
- Secrets (DB credentials, Clerk keys, gateway keys) live in `.env`, never committed to the repo (spec §11).
- Framework is Next.js (App Router); database is self-hosted Postgres; queue is Redis + BullMQ (spec §12). Redis is provisioned in this plan even though nothing consumes it yet — the Invoicing Core plan wires up BullMQ.

---

### Task 1: Project scaffold, test harness, and first real utility (E.164 validation)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx` (via `create-next-app`)
- Create: `vitest.config.ts`
- Create: `src/lib/phone.ts`
- Test: `src/lib/__tests__/phone.test.ts`

**Interfaces:**
- Produces: `isValidE164(phone: string): boolean` in `src/lib/phone.ts` — later tasks (client creation, CSV import) validate phone numbers with this.
- Produces: a working `npm test` command (Vitest) that later tasks' tests plug into.

- [ ] **Step 1: Scaffold the Next.js app**

Run from the project root (`C:\Users\Raziq Shafiee\Desktop\WhatsappAutoBill`):

```bash
npx create-next-app@latest . --typescript --app --eslint --tailwind --src-dir --import-alias "@/*" --use-npm --yes
```

If the installed `create-next-app` version doesn't support `--yes`, answer the prompts manually with the same choices (TypeScript: yes, App Router: yes, `src/` directory: yes, import alias: `@/*`, Tailwind: yes, ESLint: yes).

- [ ] **Step 2: Install and configure Vitest**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

Add to `package.json` `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Write the failing test for E.164 validation**

Create `src/lib/__tests__/phone.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isValidE164 } from '../phone'

describe('isValidE164', () => {
  it('accepts a valid Malaysian E.164 number', () => {
    expect(isValidE164('+60123456789')).toBe(true)
  })

  it('rejects a number missing the leading +', () => {
    expect(isValidE164('60123456789')).toBe(false)
  })

  it('rejects a number containing letters', () => {
    expect(isValidE164('+601234abcde')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidE164('')).toBe(false)
  })

  it('rejects a number starting with 0 right after the +', () => {
    expect(isValidE164('+0123456789')).toBe(false)
  })
})
```

- [ ] **Step 4: Run the test and verify it fails**

Run: `npm test`
Expected: FAIL with a module-not-found or "isValidE164 is not exported" error, since `src/lib/phone.ts` doesn't exist yet.

- [ ] **Step 5: Implement the minimal E.164 validator**

Create `src/lib/phone.ts`:

```ts
const E164_REGEX = /^\+[1-9]\d{1,14}$/

export function isValidE164(phone: string): boolean {
  return E164_REGEX.test(phone)
}
```

- [ ] **Step 6: Run the test and verify it passes**

Run: `npm test`
Expected: PASS, all 5 assertions in `phone.test.ts` green.

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js app with Vitest and E.164 phone validator"
```

---

### Task 2: Local Postgres and Redis via Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.gitignore` entries for `.env`, `.env.test` (extend the one `create-next-app` generated)

**Interfaces:**
- Produces: Postgres reachable at `localhost:5432`, databases `kutip_dev` and `kutip_test`, user `kutip` — Task 3's Prisma setup connects here.
- Produces: Redis reachable at `localhost:6379` — unused until the Invoicing Core plan, but provisioned now per the spec's tech stack.
- Produces: `.env.example` documenting every environment variable this plan introduces.

- [ ] **Step 1: Write the Docker Compose file**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: kutip
      POSTGRES_PASSWORD: kutip_dev_password
      POSTGRES_DB: kutip_dev
    ports:
      - "5432:5432"
    volumes:
      - kutip_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kutip"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  kutip_postgres_data:
```

- [ ] **Step 2: Start the stack**

Run: `docker compose up -d`
Expected: both services report `healthy` within ~15 seconds.

Run: `docker compose ps`
Expected: `postgres` and `redis` both show `STATUS: Up ... (healthy)`.

- [ ] **Step 3: Create the test database**

Run:

```bash
docker compose exec postgres createdb -U kutip kutip_test
```

Verify: `docker compose exec postgres psql -U kutip -l` lists both `kutip_dev` and `kutip_test`.

- [ ] **Step 4: Write `.env.example` and local env files**

Create `.env.example`:

```
DATABASE_URL="postgresql://kutip:kutip_dev_password@localhost:5432/kutip_dev"
REDIS_URL="redis://localhost:6379"
CLERK_SECRET_KEY=""
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
```

Copy it to real local env files (these stay untracked):

```bash
cp .env.example .env
cp .env.example .env.test
```

Edit `.env.test` and change the `DATABASE_URL` database name from `kutip_dev` to `kutip_test`.

- [ ] **Step 5: Ensure secrets are gitignored**

Confirm `.gitignore` (created by `create-next-app`) already contains `.env*`. If it only lists `.env.local`, add these lines:

```
.env
.env.test
```

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example .gitignore
git commit -m "chore: add Docker Compose for local Postgres and Redis"
```

---

### Task 3: Prisma schema and tenant-scoped data model

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Test: `src/lib/__tests__/tenant-scoping.integration.test.ts`
- Modify: `package.json` (add `prisma` scripts and `dotenv-cli` dev dependency)

**Interfaces:**
- Consumes: `DATABASE_URL` / test DB from Task 2.
- Produces: Prisma models `Business`, `Client`, `BillingRule`, `Invoice`, `Payment`, `ReminderJob`, `MessageLog` and enums `BillingFrequency`, `InvoiceStatus`, `ReminderStage`, `ReminderStatus`, `MessageChannel`, `DeliveryStatus` — every later plan (invoicing, WhatsApp, payments) builds on these exact names.
- Produces: `prisma: PrismaClient` singleton exported from `src/lib/prisma.ts` — all future DB access goes through this import.

- [ ] **Step 1: Install Prisma**

```bash
npm install prisma @prisma/client
npm install -D dotenv-cli
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and a `.env` reference — the datasource URL will read from `DATABASE_URL`, which Task 2 already put in `.env`.

- [ ] **Step 2: Write the full schema**

Replace the generated `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Business {
  id         String   @id @default(cuid())
  clerkOrgId String   @unique
  name       String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  clients      Client[]
  billingRules BillingRule[]
  invoices     Invoice[]
}

model Client {
  id              String   @id @default(cuid())
  tenantId        String
  business        Business @relation(fields: [tenantId], references: [id])
  name            String
  phoneE164       String
  serviceTier     String?
  billingAmount   Decimal  @db.Decimal(10, 2)
  billingCycleDay Int
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  invoices Invoice[]

  @@index([tenantId])
}

enum BillingFrequency {
  MONTHLY
  QUARTERLY
  CUSTOM
}

model BillingRule {
  id              String            @id @default(cuid())
  tenantId        String
  business        Business          @relation(fields: [tenantId], references: [id])
  frequency       BillingFrequency
  gracePeriodDays Int               @default(0)
  lateFeeAmount   Decimal?          @db.Decimal(10, 2)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([tenantId])
}

enum InvoiceStatus {
  DRAFT
  ISSUED
  PAID
  OVERDUE
  ARCHIVED
}

model Invoice {
  id        String        @id @default(cuid())
  tenantId  String
  business  Business      @relation(fields: [tenantId], references: [id])
  clientId  String
  client    Client        @relation(fields: [clientId], references: [id])
  amount    Decimal       @db.Decimal(10, 2)
  status    InvoiceStatus @default(DRAFT)
  dueDate   DateTime
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  payments  Payment[]
  reminders ReminderJob[]
  messages  MessageLog[]

  @@index([tenantId])
}

model Payment {
  id         String   @id @default(cuid())
  invoiceId  String
  invoice    Invoice  @relation(fields: [invoiceId], references: [id])
  gatewayRef String
  amount     Decimal  @db.Decimal(10, 2)
  paidAt     DateTime @default(now())

  @@index([invoiceId])
}

enum ReminderStage {
  T_MINUS_3
  T_0
  T_PLUS_3
  T_PLUS_7
}

enum ReminderStatus {
  PENDING
  SENT
  SKIPPED
}

model ReminderJob {
  id           String         @id @default(cuid())
  invoiceId    String
  invoice      Invoice        @relation(fields: [invoiceId], references: [id])
  stage        ReminderStage
  scheduledFor DateTime
  status       ReminderStatus @default(PENDING)

  @@index([invoiceId])
}

enum MessageChannel {
  WHATSAPP_CLOUD_API
  WHATSAPP_QR_SESSION
}

enum DeliveryStatus {
  QUEUED
  SENT
  DELIVERED
  READ
  FAILED
}

model MessageLog {
  id        String         @id @default(cuid())
  invoiceId String
  invoice   Invoice        @relation(fields: [invoiceId], references: [id])
  channel   MessageChannel
  template  String
  status    DeliveryStatus @default(QUEUED)
  sentAt    DateTime?

  @@index([invoiceId])
}
```

Note: `BillingRule` is tied to `Business` (global per tenant) for this Foundation plan. The PRD mentions per-client rule overrides as a possible refinement — that extension belongs to the Invoicing Core plan, not here.

- [ ] **Step 3: Run the migration against the dev database**

```bash
npx prisma migrate dev --name init
```

Expected: migration applies cleanly, `prisma/migrations/<timestamp>_init/migration.sql` is created, Prisma Client is generated.

- [ ] **Step 4: Create the Prisma client singleton**

Create `src/lib/prisma.ts`:

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 5: Add npm scripts for migrating the test database**

Add to `package.json` `"scripts"`:

```json
"prisma:migrate:test": "dotenv -e .env.test -- npx prisma migrate deploy",
"test:integration": "dotenv -e .env.test -- vitest run src/lib/__tests__/tenant-scoping.integration.test.ts"
```

Run: `npm run prisma:migrate:test`
Expected: the same migration applies to `kutip_test` cleanly.

- [ ] **Step 6: Write the failing tenant-scoping integration test**

Create `src/lib/__tests__/tenant-scoping.integration.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../prisma'

describe('tenant scoping', () => {
  beforeEach(async () => {
    await prisma.client.deleteMany()
    await prisma.business.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('only returns clients belonging to the given tenant', async () => {
    const businessA = await prisma.business.create({
      data: { clerkOrgId: 'org_a', name: 'Tuition Center A' },
    })
    const businessB = await prisma.business.create({
      data: { clerkOrgId: 'org_b', name: 'Tuition Center B' },
    })

    await prisma.client.create({
      data: {
        tenantId: businessA.id,
        name: 'Ali',
        phoneE164: '+60123456789',
        billingAmount: 150,
        billingCycleDay: 1,
      },
    })
    await prisma.client.create({
      data: {
        tenantId: businessB.id,
        name: 'Siti',
        phoneE164: '+60129876543',
        billingAmount: 200,
        billingCycleDay: 15,
      },
    })

    const clientsForA = await prisma.client.findMany({
      where: { tenantId: businessA.id },
    })

    expect(clientsForA).toHaveLength(1)
    expect(clientsForA[0].name).toBe('Ali')
  })
})
```

- [ ] **Step 7: Run the test and verify it fails first, then passes**

Run: `npm run test:integration`
Expected on first run (before Step 6's file existed in a runnable state, or if `DATABASE_URL` in `.env.test` still points at `kutip_dev`): a clear failure — either a connection error to the wrong database or a failed assertion. Fix the `.env.test` `DATABASE_URL` if needed, then re-run.

Run: `npm run test:integration`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add prisma package.json package-lock.json src/lib/prisma.ts src/lib/__tests__/tenant-scoping.integration.test.ts
git commit -m "feat: add Prisma schema and tenant-scoped data model"
```

---

### Task 4: Clerk authentication with Organization-to-tenant mapping

**Files:**
- Create: `src/middleware.ts`
- Create: `src/app/sign-in/[[...sign-in]]/page.tsx`
- Create: `src/app/sign-up/[[...sign-up]]/page.tsx`
- Create: `src/lib/tenant.ts`
- Test: `src/lib/__tests__/tenant.integration.test.ts`
- Modify: `src/app/layout.tsx` (wrap with `ClerkProvider`)

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts` (Task 3), `Business` model.
- Produces: `getOrCreateTenantForOrg(clerkOrgId: string, name: string): Promise<Business>` in `src/lib/tenant.ts` — Task 5's dashboard page and every later plan's server actions resolve the current tenant through this function.
- Produces: Clerk middleware protecting any route under `/dashboard`.

- [ ] **Step 1: Install Clerk**

```bash
npm install @clerk/nextjs
```

- [ ] **Step 2: Manual setup — create a Clerk application (cannot be automated)**

Go to https://dashboard.clerk.com, create an application, enable **Organizations** under the Organizations settings tab (off by default). Copy the publishable key and secret key into `.env`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
```

- [ ] **Step 3: Wrap the app in `ClerkProvider`**

Modify `src/app/layout.tsx` to wrap the existing `<html>`/`<body>` content:

```tsx
import { ClerkProvider } from '@clerk/nextjs'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

Keep any existing font/className setup from the scaffolded file — only add the `ClerkProvider` wrapper.

- [ ] **Step 4: Add the auth middleware**

Create `src/middleware.ts`:

```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/', '/(api|trpc)(.*)'],
}
```

- [ ] **Step 5: Add sign-in and sign-up pages**

Create `src/app/sign-in/[[...sign-in]]/page.tsx`:

```tsx
import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return <SignIn />
}
```

Create `src/app/sign-up/[[...sign-up]]/page.tsx`:

```tsx
import { SignUp } from '@clerk/nextjs'

export default function Page() {
  return <SignUp />
}
```

- [ ] **Step 6: Write the failing test for tenant resolution**

Create `src/lib/__tests__/tenant.integration.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../prisma'
import { getOrCreateTenantForOrg } from '../tenant'

describe('getOrCreateTenantForOrg', () => {
  beforeEach(async () => {
    await prisma.business.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates a new Business on first call for an org', async () => {
    const business = await getOrCreateTenantForOrg('org_new', 'New Tuition Center')

    expect(business.clerkOrgId).toBe('org_new')
    expect(business.name).toBe('New Tuition Center')
  })

  it('returns the existing Business on subsequent calls, updating the name', async () => {
    await getOrCreateTenantForOrg('org_repeat', 'Old Name')
    const updated = await getOrCreateTenantForOrg('org_repeat', 'New Name')

    const all = await prisma.business.findMany({ where: { clerkOrgId: 'org_repeat' } })

    expect(all).toHaveLength(1)
    expect(updated.name).toBe('New Name')
  })
})
```

- [ ] **Step 7: Run the test and verify it fails**

Run: `npx dotenv -e .env.test -- vitest run src/lib/__tests__/tenant.integration.test.ts`
Expected: FAIL — `src/lib/tenant.ts` doesn't exist yet.

- [ ] **Step 8: Implement `getOrCreateTenantForOrg`**

Create `src/lib/tenant.ts`:

```ts
import { prisma } from './prisma'
import type { Business } from '@prisma/client'

export async function getOrCreateTenantForOrg(
  clerkOrgId: string,
  name: string
): Promise<Business> {
  return prisma.business.upsert({
    where: { clerkOrgId },
    update: { name },
    create: { clerkOrgId, name },
  })
}
```

- [ ] **Step 9: Run the test and verify it passes**

Run: `npx dotenv -e .env.test -- vitest run src/lib/__tests__/tenant.integration.test.ts`
Expected: PASS, both assertions green.

- [ ] **Step 10: Commit**

```bash
git add src/middleware.ts src/app/layout.tsx "src/app/sign-in" "src/app/sign-up" src/lib/tenant.ts src/lib/__tests__/tenant.integration.test.ts package.json package-lock.json
git commit -m "feat: add Clerk auth with Organization-to-tenant mapping"
```

---

### Task 5: Protected dashboard shell (end-to-end verification)

**Files:**
- Create: `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `auth()` from `@clerk/nextjs/server`, `getOrCreateTenantForOrg` from `src/lib/tenant.ts` (Task 4).
- Produces: a `/dashboard` route that later plans (Invoicing Core's client roster UI, the financial pipeline dashboard) extend.

- [ ] **Step 1: Create the dashboard page**

Create `src/app/dashboard/page.tsx`:

```tsx
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getOrCreateTenantForOrg } from '@/lib/tenant'

export default async function DashboardPage() {
  const { orgId, orgSlug } = await auth()

  if (!orgId) {
    redirect('/sign-in')
  }

  const business = await getOrCreateTenantForOrg(orgId, orgSlug ?? 'My Business')

  return (
    <main>
      <h1>Welcome, {business.name}</h1>
    </main>
  )
}
```

- [ ] **Step 2: Manual end-to-end verification**

Run: `npm run dev`

1. Visit `http://localhost:3000/dashboard` while signed out.
   Expected: redirected to `/sign-in`.
2. Sign up for a new account through the Clerk UI, then create an Organization when prompted (or via the Clerk dashboard's Organizations tab if Clerk doesn't prompt automatically).
3. Visit `/dashboard` again.
   Expected: page renders `Welcome, <your organization name>` with no redirect.
4. Check the `kutip_dev` database:

```bash
docker compose exec postgres psql -U kutip -d kutip_dev -c "SELECT id, \"clerkOrgId\", name FROM \"Business\";"
```

   Expected: one row matching the organization you created.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard
git commit -m "feat: add protected dashboard shell resolving the current tenant"
```

---

## Definition of Done

- `npm test` and `npm run test:integration` both pass.
- `docker compose up -d` brings up healthy Postgres and Redis containers.
- `npx prisma migrate dev` has been applied; `prisma/schema.prisma` matches Task 3.
- A signed-in user with a Clerk Organization can load `/dashboard` and see their business name, and a matching `Business` row exists in Postgres.
- All five tasks are committed as separate commits.
