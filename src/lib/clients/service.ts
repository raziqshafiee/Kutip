import { prisma } from '../prisma'
import { isValidE164 } from '../phone'
import type { Client } from '../../generated/prisma/client'

export type ClientInput = {
  name: string
  phoneE164: string
  serviceTier?: string
  billingAmount: number
  billingCycleDay: number
}

export type ClientResult = { ok: true } | { ok: false; error: string }

export function validateClientInput(input: ClientInput): string | null {
  if (!input.name || input.name.trim() === '') {
    return 'Name is required'
  }
  if (!isValidE164(input.phoneE164)) {
    return 'Phone number must be in E.164 format (e.g. +60123456789)'
  }
  if (!Number.isFinite(input.billingAmount) || input.billingAmount <= 0) {
    return 'Billing amount must be a positive number'
  }
  if (
    !Number.isInteger(input.billingCycleDay) ||
    input.billingCycleDay < 1 ||
    input.billingCycleDay > 31
  ) {
    return 'Billing cycle day must be a whole number between 1 and 31'
  }
  return null
}

export async function listClientsForTenant(tenantId: string): Promise<Client[]> {
  return prisma.client.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  })
}

export async function createClientForTenant(
  tenantId: string,
  input: ClientInput
): Promise<ClientResult> {
  const error = validateClientInput(input)
  if (error) {
    return { ok: false, error }
  }

  await prisma.client.create({
    data: {
      tenantId,
      name: input.name.trim(),
      phoneE164: input.phoneE164,
      serviceTier: input.serviceTier?.trim() || null,
      billingAmount: input.billingAmount,
      billingCycleDay: input.billingCycleDay,
    },
  })

  return { ok: true }
}

export async function updateClientForTenant(
  tenantId: string,
  clientId: string,
  input: ClientInput
): Promise<ClientResult> {
  const error = validateClientInput(input)
  if (error) {
    return { ok: false, error }
  }

  const existing = await prisma.client.findFirst({ where: { id: clientId, tenantId } })
  if (!existing) {
    return { ok: false, error: 'Client not found' }
  }

  await prisma.client.update({
    where: { id: clientId },
    data: {
      name: input.name.trim(),
      phoneE164: input.phoneE164,
      serviceTier: input.serviceTier?.trim() || null,
      billingAmount: input.billingAmount,
      billingCycleDay: input.billingCycleDay,
    },
  })

  return { ok: true }
}

export async function deleteClientForTenant(
  tenantId: string,
  clientId: string
): Promise<ClientResult> {
  const existing = await prisma.client.findFirst({ where: { id: clientId, tenantId } })
  if (!existing) {
    return { ok: false, error: 'Client not found' }
  }

  const invoiceCount = await prisma.invoice.count({ where: { clientId } })
  if (invoiceCount > 0) {
    return { ok: false, error: 'This client has billing history and cannot be deleted' }
  }

  await prisma.client.delete({ where: { id: clientId } })
  return { ok: true }
}
