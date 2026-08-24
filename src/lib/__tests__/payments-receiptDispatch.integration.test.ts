import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '../prisma'
import { buildReminderPayload } from '../whatsapp/templates'
import { dispatchPaymentConfirmation } from '../payments/receiptDispatch'

function mockFetchOk() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => '{}',
    json: async () => ({ messages: [{ id: 'wamid_pay' }] }),
  }) as unknown as typeof fetch
}

describe('receipt dispatch + payment link (integration)', () => {
  let businessId: string
  let clientId: string
  let invoiceId: string
  let paymentId: string

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
        clerkOrgId: 'org_receipt',
        name: 'Receipt Tenant',
        whatsappChannel: 'CLOUD_API',
        cloudApiPhoneNumberId: '111222333',
        cloudApiAccessToken: 'EAAToken',
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
        serviceTier: 'Monthly Tuition',
      },
    })
    clientId = client.id
    const invoice = await prisma.invoice.create({
      data: {
        tenantId: business.id,
        clientId: client.id,
        amount: 150,
        dueDate: new Date('2026-08-15'),
        status: 'PAID',
      },
    })
    invoiceId = invoice.id
    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        gatewayRef: invoice.id,
        amount: 150,
        status: 'PAID',
      },
    })
    paymentId = payment.id

    vi.stubGlobal('fetch', mockFetchOk())
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    await prisma.$disconnect()
  })

  it('builds a reminder payload with a real invoice payment link', async () => {
    const { vars } = await buildReminderPayload(invoiceId, 'T_0')
    expect(vars.payment_link).toContain(`/invoices/${invoiceId}`)
    expect(vars.client_name).toBe('Alya')
  })

  it('dispatches a payment confirmation and creates a MessageLog', async () => {
    const result = await dispatchPaymentConfirmation(paymentId)
    expect(result.sent).toBe(true)

    const log = await prisma.messageLog.findFirst({ where: { invoiceId } })
    expect(log).not.toBeNull()
    expect(log?.template).toBe('payment_received')
    expect(log?.status).toBe('SENT')
  })
})