import type { Client, BillingFrequency } from '../../generated/prisma/client'
import { prisma } from '../prisma'

export type DueInvoiceInput = {
  amount: number
  dueDate: Date
}

/**
 * Returns the number of days in the month of `date`.
 */
export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

/**
 * Computes the billing due date for a client based on its cycle day.
 * The due date lands on `cycleDay` of the anchor month (capped to the
 * last day of the month) plus `gracePeriodDays`.
 *
 * `frequency` is accepted for signature stability with quarterly/custom
 * billing; the MVP computes the due date on a monthly cadence.
 */
export function computeBillingDueDate(
  cycleDay: number,
  frequency: BillingFrequency,
  anchorDate: Date,
  gracePeriodDays = 0
): Date {
  const capped = Math.min(cycleDay, daysInMonth(anchorDate))
  const base = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), capped)
  base.setDate(base.getDate() + gracePeriodDays)
  return base
}

/**
 * Finds clients for a tenant whose billing cycle day matches the day of the
 * reference date. Day-of-month matching is capped to the month length, so a
 * cycle day of 31 still matches a 30-day month on the 30th.
 */
export async function findClientsDueForBilling(
  tenantId: string,
  referenceDate: Date
): Promise<Client[]> {
  const dayOfMonth = referenceDate.getDate()
  const monthLength = daysInMonth(referenceDate)

  // A client is due when its cycle day equals the current day. Additionally,
  // when today is the last day of a month shorter than the client's cycle
  // day (e.g. day 31 in a 30-day month), the capped client is also due.
  const OR: Array<{ billingCycleDay: { in: number[] } | { gt: number } }> = [
    { billingCycleDay: { in: [dayOfMonth] } },
  ]
  if (dayOfMonth === monthLength) {
    OR.push({ billingCycleDay: { gt: monthLength } })
  }

  return prisma.client.findMany({
    where: {
      tenantId,
      OR,
    },
  })
}

/**
 * Builds the amount and due date for a client's invoice, applying the
 * tenant's billing rule grace period. Late fees are NOT applied at
 * generation time (only at the overdue transition).
 */
export async function buildInvoiceForClient(
  client: Client,
  referenceDate: Date
): Promise<DueInvoiceInput> {
  const billingRule = await prisma.billingRule.findFirst({
    where: { tenantId: client.tenantId },
  })

  const frequency = billingRule?.frequency ?? 'MONTHLY'
  const gracePeriodDays = billingRule?.gracePeriodDays ?? 0

  const dueDate = computeBillingDueDate(
    client.billingCycleDay,
    frequency,
    referenceDate,
    gracePeriodDays
  )

  return {
    amount: client.billingAmount.toNumber(),
    dueDate,
  }
}