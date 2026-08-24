import { describe, it, expect } from 'vitest'
import { isValidE164 } from '../phone'

describe('isValidE164', () => {
  it('accepts a valid Malaysian E.164 number', () => {
    expect(isValidE164('+60123456789')).toBe(true)
  })

  it('rejects a number missing the leading +', () => {
    expect(isValidE164('60123456789')).toBe(false)
  })

  it('rejects a number containing letters', () => {
    expect(isValidE164('+601234abcde')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidE164('')).toBe(false)
  })

  it('rejects a number starting with 0 right after the +', () => {
    expect(isValidE164('+0123456789')).toBe(false)
  })
})
