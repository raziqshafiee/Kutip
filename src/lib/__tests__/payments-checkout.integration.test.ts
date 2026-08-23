import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '../prisma'
import { createPaymentForInvoice } from '../payments/checkout'

describe('checkout (integration)', () => {
  let businessId: string
  let clientId: string
  let invoiceId: string

  beforeEach(async () => {
    await prisma.messageLog.deleteMany()
    await prisma.reminderJob.deleteMany()
    await prisma.payment.deleteMany()
    await prisma.invoice.deleteMany()
    await prisma.client.deleteMany()
    await prisma.billingRule.deleteMany()
    await prisma.business.deleteMany()

    const business = await prisma.business.create({
      data: {
        clerkOrgId: 'org_checkout',
        name: 'Checkout Tenant',
        toyyibpayUserSecretKey: 'sk_secret',
        toyyibpayCategoryCode: 'cat_x',
        toyyibpaySandbox: true,
      },
    })
    businessId = business.id
    const client = await prisma.client.create({
      data: {
        tenantId: business.id,
        name: 'Alya',
        phoneE164: '+60123456789',
        billingAmount: 150,
        billingCycleDay: 15,
      },
    })
    clientId = client.id
    const invoice = await prisma.invoice.create({
      data: {
        tenantId: business.id,
        clientId: client.id,
        amount: 150,
        dueDate: new Date('2026-08-15'),
        status: 'ISSUED',
      },
    })
    invoiceId = invoice.id

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => '[]', json: async () => [{ BillCode: 'BC001' }],
    }) as unknown as typeof fetch)
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    await prisma.$disconnect()
  })

  it('creates a PENDING payment and returns a payment URL', async () => {
    const { paymentUrl } = await createPaymentForInvoice(invoiceId)
    expect(paymentUrl).toContain('dev.toyyibpay.com')

    const payment = await prisma.payment.findFirst({ where: { invoiceId } })
    expect(payment).not.toBeNull()
    expect(payment?.status).toBe('PENDING')
    expect(payment?.billCode).toBe('BC001')
  })

  it('throws for an already-paid invoice', async () => {
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'PAID' } })
    await expect(createPaymentForInvoice(invoiceId)).rejects.toThrow('already paid')
  })
})