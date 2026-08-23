import { prisma } from '../prisma'
import type { Invoice, ReminderJob, ReminderStage } from '../../generated/prisma/client'

/**
 * Creates the initial reminder jobs for a freshly issued invoice:
 * T-3 (3 days before due) and T0 (on the due date).
 */
export async function scheduleInvoiceReminders(
  invoice: Invoice,
  _referenceDate: Date
): Promise<ReminderJob[]> {
  const due = new Date(invoice.dueDate)

  const tMinus3 = new Date(due)
  tMinus3.setDate(tMinus3.getDate() - 3)

  const jobs: { stage: ReminderStage; scheduledFor: Date }[] = [
    { stage: 'T_MINUS_3', scheduledFor: tMinus3 },
    { stage: 'T_0', scheduledFor: due },
  ]

  const created: ReminderJob[] = []
  for (const j of jobs) {
    const row = await prisma.reminderJob.create({
      data: {
        invoiceId: invoice.id,
        stage: j.stage,
        scheduledFor: j.scheduledFor,
        status: 'PENDING',
      },
    })
    created.push(row)
  }
  return created
}

/**
 * Enqueues the T+3 and T+7 follow-up reminder jobs, but only if the invoice
 * is still unpaid (status ISSUED or OVERDUE, not PAID or ARCHIVED).
 */
export async function scheduleFollowUpReminders(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
  })

  if (invoice.status === 'PAID' || invoice.status === 'ARCHIVED') {
    return
  }

  const due = new Date(invoice.dueDate)
  const tPlus3 = new Date(due)
  tPlus3.setDate(tPlus3.getDate() + 3)
  const tPlus7 = new Date(due)
  tPlus7.setDate(tPlus7.getDate() + 7)

  const jobs: { stage: ReminderStage; scheduledFor: Date }[] = [
    { stage: 'T_PLUS_3', scheduledFor: tPlus3 },
    { stage: 'T_PLUS_7', scheduledFor: tPlus7 },
  ]

  for (const j of jobs) {
    await prisma.reminderJob.create({
      data: {
        invoiceId,
        stage: j.stage,
        scheduledFor: j.scheduledFor,
        status: 'PENDING',
      },
    })
  }
}