import { describe, it, expect } from 'vitest'
import { daysInMonth, computeBillingDueDate } from '../invoice/generator'

describe('daysInMonth', () => {
  it('returns 31 for January', () => {
    expect(daysInMonth(new Date('2026-01-15'))).toBe(31)
  })

  it('returns 30 for April', () => {
    expect(daysInMonth(new Date('2026-04-10'))).toBe(30)
  })

  it('returns 29 for leap-year February (2028)', () => {
    expect(daysInMonth(new Date('2028-02-05'))).toBe(29)
  })

  it('returns 28 for non-leap February (2026)', () => {
    expect(daysInMonth(new Date('2026-02-05'))).toBe(28)
  })
})

describe('computeBillingDueDate', () => {
  it('places the due date on the cycle day of the anchor month', () => {
    const due = computeBillingDueDate(15, 'MONTHLY', new Date('2026-08-10'))
    expect(due.getFullYear()).toBe(2026)
    expect(due.getMonth()).toBe(7) // August (0-indexed)
    expect(due.getDate()).toBe(15)
  })

  it('caps cycle day greater than days in month to the month end', () => {
    const due = computeBillingDueDate(31, 'MONTHLY', new Date('2026-04-05'))
    expect(due.getDate()).toBe(30)
  })

  it('caps cycle day 31 to 28 in non-leap February', () => {
    const due = computeBillingDueDate(31, 'MONTHLY', new Date('2026-02-05'))
    expect(due.getDate()).toBe(28)
  })

  it('applies grace period days after the due date', () => {
    const due = computeBillingDueDate(15, 'MONTHLY', new Date('2026-08-10'), 5)
    expect(due.getDate()).toBe(20)
  })
})