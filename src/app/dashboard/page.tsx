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
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">
        Welcome, {business.name}
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Your Kutip dashboard is ready. Billing, invoicing, and WhatsApp automation
        features are on the way.
      </p>
    </main>
  )
}