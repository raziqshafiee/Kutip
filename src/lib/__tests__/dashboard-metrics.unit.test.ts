import { describe, it, expect } from 'vitest'
import { classifyStatus } from '../dashboard/metrics'

describe('classifyStatus', () => {
  it('classifies PAID as collected', () => {
    expect(classifyStatus('PAID')).toBe('collected')
  })

  it('classifies ISSUED as pending', () => {
    expect(classifyStatus('ISSUED')).toBe('pending')
  })

  it('classifies OVERDUE as defaultRisk', () => {
    expect(classifyStatus('OVERDUE')).toBe('defaultRisk')
  })

  it('ignores DRAFT and ARCHIVED', () => {
    expect(classifyStatus('DRAFT')).toBe('ignored')
    expect(classifyStatus('ARCHIVED')).toBe('ignored')
  })
})