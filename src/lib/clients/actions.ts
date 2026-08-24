'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { getOrCreateTenantForOrg } from '../tenant'
import { createClientForTenant, updateClientForTenant, deleteClientForTenant } from './service'
import type { ClientInput, ClientResult } from './service'

async function resolveTenantId(): Promise<string | null> {
  const { orgId, orgSlug } = await auth()
  if (!orgId) {
    return null
  }
  const business = await getOrCreateTenantForOrg(orgId, orgSlug ?? 'My Business')
  return business.id
}

export async function createClientAction(input: ClientInput): Promise<ClientResult> {
  const tenantId = await resolveTenantId()
  if (!tenantId) {
    return { ok: false, error: 'Not authenticated' }
  }
  const result = await createClientForTenant(tenantId, input)
  if (result.ok) {
    revalidatePath('/dashboard/clients')
  }
  return result
}

export async function updateClientAction(
  clientId: string,
  input: ClientInput
): Promise<ClientResult> {
  const tenantId = await resolveTenantId()
  if (!tenantId) {
    return { ok: false, error: 'Not authenticated' }
  }
  const result = await updateClientForTenant(tenantId, clientId, input)
  if (result.ok) {
    revalidatePath('/dashboard/clients')
  }
  return result
}

export async function deleteClientAction(clientId: string): Promise<ClientResult> {
  const tenantId = await resolveTenantId()
  if (!tenantId) {
    return { ok: false, error: 'Not authenticated' }
  }
  const result = await deleteClientForTenant(tenantId, clientId)
  if (result.ok) {
    revalidatePath('/dashboard/clients')
  }
  return result
}
