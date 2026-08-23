export const INVOICE_QUEUE = 'invoices'
export const REMINDER_QUEUE = 'reminders'

export type InvoiceGenerateJob = {
  tenantId: string
  referenceDate: string // ISO date (YYYY-MM-DD) of the sweep
}

export type ReminderDispatchJob = {
  invoiceId: string
  stage: 'T_MINUS_3' | 'T_0' | 'T_PLUS_3' | 'T_PLUS_7'
}