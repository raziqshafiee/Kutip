import { describe, it, expect } from 'vitest'
import { renderInvoiceDocument } from '../invoice/pdf'

describe('invoice PDF generation', () => {
  it('returns a non-empty Buffer starting with the %PDF magic header', async () => {
    const buf = await renderInvoiceDocument({
      businessName: 'Tuition Center A',
      clientName: 'Ali',
      amount: 150,
      dueDate: new Date('2026-08-15'),
      kind: 'INVOICE',
      ref: 'inv_1',
    })

    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(0)
    expect(buf.subarray(0, 4).toString('latin1')).toBe('%PDF')
  })

  it('renders a receipt with different kind label', async () => {
    const buf = await renderInvoiceDocument({
      businessName: 'Tuition Center A',
      clientName: 'Ali',
      amount: 150,
      dueDate: new Date('2026-08-15'),
      kind: 'RECEIPT',
      ref: 'pay_1',
    })

    expect(buf.subarray(0, 4).toString('latin1')).toBe('%PDF')
  })
})