import { describe, it, expect } from 'vitest'
import { canTransition } from '../invoice/service'

describe('invoice state machine', () => {
  it('allows DRAFT -> ISSUED', () => {
    expect(canTransition('DRAFT', 'ISSUED')).toBe(true)
  })

  it('allows ISSUED -> PAID, OVERDUE, and ARCHIVED', () => {
    expect(canTransition('ISSUED', 'PAID')).toBe(true)
    expect(canTransition('ISSUED', 'OVERDUE')).toBe(true)
    expect(canTransition('ISSUED', 'ARCHIVED')).toBe(true)
  })

  it('allows OVERDUE -> PAID and ARCHIVED', () => {
    expect(canTransition('OVERDUE', 'PAID')).toBe(true)
    expect(canTransition('OVERDUE', 'ARCHIVED')).toBe(true)
  })

  it('rejects DRAFT -> PAID directly', () => {
    expect(canTransition('DRAFT', 'PAID')).toBe(false)
  })

  it('rejects DRAFT -> ARCHIVED directly', () => {
    expect(canTransition('DRAFT', 'ARCHIVED')).toBe(false)
  })

  it('rejects transitions out of PAID and ARCHIVED', () => {
    expect(canTransition('PAID', 'OVERDUE')).toBe(false)
    expect(canTransition('ARCHIVED', 'ISSUED')).toBe(false)
  })
})