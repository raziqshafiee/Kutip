import { createWorker } from '../queue'
import { INVOICE_QUEUE, REMINDER_QUEUE } from './definitions'
import type { InvoiceGenerateJob, ReminderDispatchJob } from './definitions'
import { runDailySweep } from './sweep'
import { DAILY_SWEEP_JOB, registerDailySweepCron } from './cron'
import { dispatchReminderJob } from '../whatsapp/dispatcher'
import { startQrWorkers } from '../whatsapp/qrWorker'

/**
 * Registers the BullMQ workers for the invoicing core and starts them.
 * Registers the repeatable daily-sweep cron, starts the sweep worker, and
 * wires the reminder-dispatch worker to send WhatsApp reminders.
 */
export async function startInvoicingWorkers(): Promise<void> {
  await registerDailySweepCron()

  createWorker<InvoiceGenerateJob>(INVOICE_QUEUE, async (job) => {
    if (job.data.tenantId === '*') {
      const referenceDate = new Date(job.data.referenceDate)
      await runDailySweep(referenceDate)
    }
  })

  createWorker<ReminderDispatchJob>(REMINDER_QUEUE, async (job) => {
    await dispatchReminderJob(job.data)
  })

  // Connect persistent QR-session sockets for QR-enabled businesses.
  await startQrWorkers()
}

// Auto-start when this module is executed directly (e.g. `npm run workers`).
if (process.env['RUN_INVOICING_WORKERS'] === '1') {
  startInvoicingWorkers().then(() => {
    console.log(`[workers] Invoicing workers started (${DAILY_SWEEP_JOB} registered).`)
  })
}