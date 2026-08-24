import { describe, it, expect } from 'vitest'
import { verifySignature, mapMetaStatus } from '../whatsapp/webhook'

describe('verifySignature', () => {
  const secret = 'super_secret'
  const body = '{"hello":"world"}'
  const validSig =
    'sha256=' +
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('node:crypto').createHmac('sha256', secret).update(body).digest('hex')

  it('accepts a valid signature', () => {
    expect(verifySignature(body, validSig, secret)).toBe(true)
  })

  it('rejects a tampered body', () => {
    expect(verifySignature('{"hello":"hacked"}', validSig, secret)).toBe(false)
  })

  it('rejects a missing header', () => {
    expect(verifySignature(body, null, secret)).toBe(false)
  })

  it('rejects a wrong secret', () => {
    expect(verifySignature(body, validSig, 'wrong_secret')).toBe(false)
  })
})

describe('mapMetaStatus', () => {
  it('maps Meta statuses to the DeliveryStatus enum', () => {
    expect(mapMetaStatus('sent')).toBe('SENT')
    expect(mapMetaStatus('delivered')).toBe('DELIVERED')
    expect(mapMetaStatus('read')).toBe('READ')
    expect(mapMetaStatus('failed')).toBe('FAILED')
  })

  it('returns undefined for an unknown status', () => {
    expect(mapMetaStatus('unknown')).toBeUndefined()
  })
})