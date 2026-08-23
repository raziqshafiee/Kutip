import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createBill, verifyCallbackHash } from '../payments/toyyibpay'

describe('createBill', () => {
  const business = {
    toyyibpayUserSecretKey: 'secret123',
    toyyibpayCategoryCode: 'cat_1',
    toyyibpaySandbox: true,
    name: 'Tuition Center A',
  }
  const invoice = {
    id: 'inv_1',
    amount: { toNumber: () => 150 },
    dueDate: new Date('2026-08-15'),
  }
  const opts = {
    billTo: 'Ali',
    callbackUrl: 'https://example.com/api/payments/toyyibpay/webhook',
    returnUrl: 'https://example.com/invoices/inv_1/thanks',
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '[]',
      json: async () => [{ BillCode: 'BILL123' }],
    }) as unknown as typeof fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the bill code and payment URL', async () => {
    const result = await createBill(business, invoice, opts)
    expect(result.billCode).toBe('BILL123')
    expect(result.paymentUrl).toBe('https://dev.toyyibpay.com/BILL123')
  })

  it('posts form-encoded fields with the invoice amount and ref', async () => {
    await createBill(business, invoice, opts)
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/createBill')
    const body = new URLSearchParams(init.body as string)
    expect(body.get('billAmount')).toBe('150.00')
    expect(body.get('billExternalReferenceNo')).toBe('inv_1')
    expect(body.get('userSecretKey')).toBe('secret123')
  })

  it('throws when no BillCode is returned', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => '[]', json: async () => [],
    }) as unknown as typeof fetch)
    await expect(createBill(business, invoice, opts)).rejects.toThrow('no BillCode')
  })
})

describe('verifyCallbackHash', () => {
  it('accepts a matching hash', () => {
    const fields = { billcode: 'B1', order_id: 'O1', status_id: '1' }
    // computed: sha1(secret + B1 + O1 + 1)
    const secret = 's3cret'
    const raw = secret + 'B1O11'
    const expected = require('node:crypto').createHash('sha1').update(raw).digest('hex')
    expect(verifyCallbackHash(expected, fields, secret)).toBe(true)
  })

  it('rejects a mismatched hash', () => {
    expect(verifyCallbackHash('wronghash', { billcode: 'B1', order_id: 'O1', status_id: '1' }, 's3cret')).toBe(false)
  })
})