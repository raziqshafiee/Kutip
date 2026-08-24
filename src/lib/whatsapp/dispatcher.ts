import { prisma } from '../prisma'
import type { ReminderDispatchJob } from '../invoice/definitions'
import { dispatchReminder } from './cloudApi'

/**
 * Dispatches a due reminder for an invoice, applying the channel routing and
 * guards defined by the WhatsApp Dispatch plan.
 *
 * Rules:
 * - PAID/ARCHIVED invoices are never dispatched (guard against T+3/T+7 resends).
 * - whatsappChannel NONE -> mark the ReminderJob SKIPPED, no MessageLog.
 * - CLOUD_API -> dispatch via the Cloud API sender.
 * - QR_SESSION -> handled by the QR worker (Task 6); marks pending for now.
 */
export async function dispatchReminderJob(job: ReminderDispatchJob): Promise<{ sent: boolean }> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: job.invoiceId },
    include: {
      client: {
        include: { business: true },
      },
      reminders: {
        where: { stage: job.stage as never, status: 'PENDING' },
      },
    },
  })

  const reminder = invoice.reminders[0]

  // Guard: never resend paid or archived invoices.
  if (invoice.status === 'PAID' || invoice.status === 'ARCHIVED') {
    if (reminder) {
      await prisma.reminderJob.update({
        where: { id: reminder.id },
        data: { status: 'SKIPPED' },
      })
    }
    return { sent: false }
  }

  const channel = invoice.client.business.whatsappChannel

  // No channel configured -> skip.
  if (channel === 'NONE') {
    if (reminder) {
      await prisma.reminderJob.update({
        where: { id: reminder.id },
        data: { status: 'SKIPPED' },
      })
    }
    return { sent: false }
  }

  if (channel === 'CLOUD_API') {
    const result = await dispatchReminder(job.invoiceId, job.stage)
    if (result.sent && reminder) {
      await prisma.reminderJob.update({
        where: { id: reminder.id },
        data: { status: 'SENT' },
      })
    }
    return result
  }

  // QR_SESSION — the QR worker (Task 6) handles sending. Leave PENDING.
  return { sent: false }
}