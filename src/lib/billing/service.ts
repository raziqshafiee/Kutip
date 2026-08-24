import { prisma } from '../prisma'
import type { BillingFrequency, BillingRule } from '../../generated/prisma/client'

export type BillingRuleInput = {
  frequency: BillingFrequency
  gracePeriodDays: number
  lateFeeAmount?: number
}

export type BillingRuleResult = { ok: true } | { ok: false; error: string }

const VALID_FREQUENCIES: BillingFrequency[] = ['MONTHLY', 'QUARTERLY', 'CUSTOM']

export function validateBillingRuleInput(input: BillingRuleInput): string | null {
  if (!VALID_FREQUENCIES.includes(input.frequency)) {
    return 'Invalid billing frequency'
  }
  if (!Number.isInteger(input.gracePeriodDays) || input.gracePeriodDays < 0) {
    return 'Grace period must be a non-negative whole number of days'
  }
  if (
    input.lateFeeAmount !== undefined &&
    (!Number.isFinite(input.lateFeeAmount) || input.lateFeeAmount < 0)
  ) {
    return 'Late fee amount must be a non-negative number'
  }
  return null
}

export async function getBillingRuleForTenant(tenantId: string): Promise<BillingRule | null> {
  return prisma.billingRule.findUnique({ where: { tenantId } })
}

export async function upsertBillingRuleForTenant(
  tenantId: string,
  input: BillingRuleInput
): Promise<BillingRuleResult> {
  const error = validateBillingRuleInput(input)
  if (error) {
    return { ok: false, error }
  }

  await prisma.billingRule.upsert({
    where: { tenantId },
    update: {
      frequency: input.frequency,
      gracePeriodDays: input.gracePeriodDays,
      lateFeeAmount: input.lateFeeAmount ?? null,
    },
    create: {
      tenantId,
      frequency: input.frequency,
      gracePeriodDays: input.gracePeriodDays,
      lateFeeAmount: input.lateFeeAmount ?? null,
    },
  })

  return { ok: true }
}
