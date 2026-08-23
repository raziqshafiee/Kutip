import { createQueue } from '../queue'
import { INVOICE_QUEUE } from './definitions'
import type { InvoiceGenerateJob } from './definitions'

export const DAILY_SWEEP_JOB = 'invoice.sweep.daily'

/**
 * Registers a repeatable BullMQ job that runs the daily sweep at midnight
 * server-local time. The job payload carries the reference date so workers
 * can act on a deterministic day.
 */
export async function registerDailySweepCron(): Promise<void> {
  const queue = createQueue<InvoiceGenerateJob>(INVOICE_QUEUE)
  const now = new Date()

  await queue.upsertJobScheduler(
    DAILY_SWEEP_JOB,
    { pattern: '0 0 * * *' }, // every day at midnight
    {
      name: DAILY_SWEEP_JOB,
      data: {
        tenantId: '*',
        referenceDate: now.toISOString().slice(0, 10),
      },
    }
  )
}