import { describe, it, expect } from 'vitest'
import { INVOICE_QUEUE, REMINDER_QUEUE } from '../invoice/definitions'
import type { InvoiceGenerateJob, ReminderDispatchJob } from '../invoice/definitions'

describe('invoice queue definitions', () => {
  it('exposes distinct queue names for invoices and reminders', () => {
    expect(INVOICE_QUEUE).toBe('invoices')
    expect(REMINDER_QUEUE).toBe('reminders')
  })

  it('defines an InvoiceGenerateJob payload shape', () => {
    const job: InvoiceGenerateJob = {
      tenantId: 'tenant_1',
      referenceDate: '2026-08-23',
    }
    expect(job.tenantId).toBe('tenant_1')
    expect(job.referenceDate).toBe('2026-08-23')
  })

  it('defines a ReminderDispatchJob payload shape with all stages', () => {
    const stages: ReminderDispatchJob['stage'][] = ['T_MINUS_3', 'T_0', 'T_PLUS_3', 'T_PLUS_7']
    const job: ReminderDispatchJob = { invoiceId: 'inv_1', stage: 'T_0' }
    expect(job.invoiceId).toBe('inv_1')
    expect(stages).toContain('T_PLUS_7')
  })
})