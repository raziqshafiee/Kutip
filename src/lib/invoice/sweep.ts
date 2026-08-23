import { prisma } from '../prisma'
import { findClientsDueForBilling, buildInvoiceForClient } from './generator'
import { createInvoiceForClient, markOverdue } from './service'
import { scheduleInvoiceReminders } from './reminders'

export type SweepResult = {
  invoicesCreated: number
}

export type OverdueSweepResult = {
  markedOverdue: number
}

/**
 * Runs the midnight cron sweep: for every tenant, find clients whose billing
 * cycle day matches the reference date, create ISSUED invoices, and schedule
 * the T-3 / T0 reminder jobs.
 */
export async function runDailySweep(referenceDate: Date): Promise<SweepResult> {
  const businesses = await prisma.business.findMany()

  let invoicesCreated = 0

  for (const business of businesses) {
    const dueClients = await findClientsDueForBilling(business.id, referenceDate)

    for (const client of dueClients) {
      const input = await buildInvoiceForClient(client, referenceDate)
      const invoice = await createInvoiceForClient(client, input)
      await scheduleInvoiceReminders(invoice, referenceDate)
      invoicesCreated += 1
    }
  }

  return { invoicesCreated }
}

/**
 * Flips ISSUED invoices that are past their due date + grace period to OVERDUE.
 */
export async function runOverdueSweep(): Promise<OverdueSweepResult> {
  const overdueInvoices = await prisma.invoice.findMany({
    where: { status: 'ISSUED' },
  })

  let markedOverdue = 0
  for (const invoice of overdueInvoices) {
    const result = await markOverdue(invoice.id)
    if (result && result.status === 'OVERDUE') {
      markedOverdue += 1
    }
  }

  return { markedOverdue }
}