import { describe, it, expect } from 'vitest'
import { validateBillingRuleInput } from '../billing/service'

describe('validateBillingRuleInput', () => {
  it('accepts valid monthly input with no late fee', () => {
    expect(
      validateBillingRuleInput({ frequency: 'MONTHLY', gracePeriodDays: 3 })
    ).toBeNull()
  })

  it('rejects an invalid frequency', () => {
    expect(
      validateBillingRuleInput({
        frequency: 'YEARLY' as never,
        gracePeriodDays: 0,
      })
    ).toBe('Invalid billing frequency')
  })

  it('rejects a negative grace period', () => {
    expect(
      validateBillingRuleInput({ frequency: 'MONTHLY', gracePeriodDays: -1 })
    ).toBe('Grace period must be a non-negative whole number of days')
  })

  it('rejects a negative late fee amount', () => {
    expect(
      validateBillingRuleInput({
        frequency: 'MONTHLY',
        gracePeriodDays: 0,
        lateFeeAmount: -5,
      })
    ).toBe('Late fee amount must be a non-negative number')
  })
})
