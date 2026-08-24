import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getOrCreateTenantForOrg } from '@/lib/tenant'
import { getBillingRuleForTenant } from '@/lib/billing/service'
import { BillingRuleForm } from './billing-rule-form'

export default async function BillingRulesPage() {
  const { orgId, orgSlug } = await auth()

  if (!orgId) {
    redirect('/sign-in')
  }

  const business = await getOrCreateTenantForOrg(orgId, orgSlug ?? 'My Business')
  const rule = await getBillingRuleForTenant(business.id)

  const current = {
    frequency: (rule?.frequency ?? 'MONTHLY') as 'MONTHLY' | 'QUARTERLY' | 'CUSTOM',
    gracePeriodDays: rule?.gracePeriodDays ?? 0,
    lateFeeAmount: rule?.lateFeeAmount?.toNumber(),
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Billing Rules</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Set the billing frequency, grace period, and late fee policy for {business.name}.
      </p>
      <BillingRuleForm current={current} />
    </main>
  )
}
