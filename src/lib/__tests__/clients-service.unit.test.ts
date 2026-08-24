import { describe, it, expect } from 'vitest'
import { validateClientInput } from '../clients/service'

describe('validateClientInput', () => {
  const validInput = {
    name: 'Ali',
    phoneE164: '+60123456789',
    billingAmount: 150,
    billingCycleDay: 1,
  }

  it('accepts valid input', () => {
    expect(validateClientInput(validInput)).toBeNull()
  })

  it('rejects an empty name', () => {
    expect(validateClientInput({ ...validInput, name: '  ' })).toBe('Name is required')
  })

  it('rejects an invalid phone number', () => {
    expect(validateClientInput({ ...validInput, phoneE164: '0123456789' })).toBe(
      'Phone number must be in E.164 format (e.g. +60123456789)'
    )
  })

  it('rejects a zero billing amount', () => {
    expect(validateClientInput({ ...validInput, billingAmount: 0 })).toBe(
      'Billing amount must be a positive number'
    )
  })

  it('rejects a billing cycle day above 31', () => {
    expect(validateClientInput({ ...validInput, billingCycleDay: 32 })).toBe(
      'Billing cycle day must be a whole number between 1 and 31'
    )
  })
})
