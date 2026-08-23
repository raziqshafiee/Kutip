import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getOrCreateTenantForOrg } from '@/lib/tenant'
import { computePipelineMetrics } from '@/lib/dashboard/metrics'

function formatMYR(amount: number): string {
  return `RM ${amount.toFixed(2)}`
}

export default async function DashboardPage() {
  const { orgId, orgSlug } = await auth()

  if (!orgId) {
    redirect('/sign-in')
  }

  const business = await getOrCreateTenantForOrg(orgId, orgSlug ?? 'My Business')
  const metrics = await computePipelineMetrics(business.id)

  const cards = [
    { label: 'Expected', value: metrics.expected, accent: 'text-zinc-900 dark:text-zinc-50' },
    { label: 'Collected', value: metrics.collected, accent: 'text-green-600' },
    { label: 'Pending', value: metrics.pending, accent: 'text-amber-600' },
    { label: 'Default Risk', value: metrics.defaultRisk, accent: 'text-red-600' },
  ]

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome, {business.name}
        </h1>
        <Link
          href="/dashboard/settings"
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm text-white"
        >
          Settings
        </Link>
      </div>

      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Financial pipeline overview — {metrics.invoiceCount} invoice(s).
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
          >
            <p className="text-sm text-zinc-500">{card.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${card.accent}`}>
              {formatMYR(card.value)}
            </p>
          </div>
        ))}
      </div>
    </main>
  )
}