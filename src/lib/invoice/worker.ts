import { createWorker } from '../queue'
import { INVOICE_QUEUE } from './definitions'
import type { InvoiceGenerateJob } from './definitions'
import { runDailySweep } from './sweep'
import { DAILY_SWEEP_JOB, registerDailySweepCron } from './cron'

/**
 * Registers the BullMQ workers for the invoicing core and starts them.
 * Registers the repeatable daily-sweep cron and starts the sweep worker.
 * The reminder worker is a placeholder until the WhatsApp Dispatch plan
 * wires up actual dispatch.
 */
export async function startInvoicingWorkers(): Promise<void> {
  await registerDailySweepCron()

  createWorker<InvoiceGenerateJob>(INVOICE_QUEUE, async (job) => {
    if (job.data.tenantId === '*') {
      const referenceDate = new Date(job.data.referenceDate)
      await runDailySweep(referenceDate)
    }
  })

  // Placeholder reminder worker — real WhatsApp dispatch lands in the
  // WhatsApp Dispatch plan.
  createWorker<{ invoiceId: string; stage: string }>(INVOICE_QUEUE, async () => {
    // no-op placeholder
  })
}

// Auto-start when this module is executed directly (e.g. `npm run workers`).
if (process.env['RUN_INVOICING_WORKERS'] === '1') {
  startInvoicingWorkers().then(() => {
    console.log(`[workers] Invoicing workers started (${DAILY_SWEEP_JOB} registered).`)
  })
}