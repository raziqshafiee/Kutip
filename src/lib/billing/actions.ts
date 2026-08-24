'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { getOrCreateTenantForOrg } from '../tenant'
import { upsertBillingRuleForTenant } from './service'
import type { BillingRuleInput, BillingRuleResult } from './service'

async function resolveTenantId(): Promise<string | null> {
  const { orgId, orgSlug } = await auth()
  if (!orgId) {
    return null
  }
  const business = await getOrCreateTenantForOrg(orgId, orgSlug ?? 'My Business')
  return business.id
}

export async function upsertBillingRuleAction(
  input: BillingRuleInput
): Promise<BillingRuleResult> {
  const tenantId = await resolveTenantId()
  if (!tenantId) {
    return { ok: false, error: 'Not authenticated' }
  }
  const result = await upsertBillingRuleForTenant(tenantId, input)
  if (result.ok) {
    revalidatePath('/dashboard/billing-rules')
  }
  return result
}
