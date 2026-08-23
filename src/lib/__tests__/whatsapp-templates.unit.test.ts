import { describe, it, expect } from 'vitest'
import { renderTemplate, formatMYR } from '../whatsapp/templates'

describe('renderTemplate', () => {
  it('replaces a single variable', () => {
    expect(renderTemplate('Hello {{name}}!', { name: 'Ali' })).toBe('Hello Ali!')
  })

  it('replaces multiple variables', () => {
    const out = renderTemplate('{{client_name}} owes {{amount}}', {
      client_name: 'Siti',
      amount: 'RM 150.00',
    })
    expect(out).toBe('Siti owes RM 150.00')
  })

  it('leaves unmatched placeholders intact', () => {
    expect(renderTemplate('Hi {{unknown}}', {})).toBe('Hi {{unknown}}')
  })
})

describe('formatMYR', () => {
  it('formats a whole number with two decimals', () => {
    expect(formatMYR(150)).toBe('RM 150.00')
  })

  it('formats a decimal value', () => {
    expect(formatMYR(1234.5)).toBe('RM 1234.50')
  })
})