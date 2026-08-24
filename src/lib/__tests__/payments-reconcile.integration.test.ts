import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { prisma } from '../prisma'
import { reconcilePayment } from '../payments/reconcile'

function makeHash(secret: string, billcode: string, order_id: string, status_id: string): string {
  return createHash('sha1').update(`${secret}${billcode}${order_id}${status_id}`).digest('hex')
}

describe('payment reconciliation (integration)', () => {
  let businessId: string
  let invoiceId: string
  let paymentId: string
  const SECRET = 'sk_test'

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
        clerkOrgId: 'org_reconcile',
        name: 'Reconcile Tenant',
        toyyibpayUserSecretKey: SECRET,
        toyyibpayCategoryCode: 'cat_r',
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
    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        gatewayRef: invoice.id,
        amount: 150,
        externalRef: invoice.id,
        billCode: 'BC_REC',
        status: 'PENDING',
      },
    })
    paymentId = payment.id
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('reconciles a valid callback, flipping invoice and payment to PAID', async () => {
    const hash = makeHash(SECRET, 'BC_REC', invoiceId, '1')
    const result = await reconcilePayment({
      billcode: 'BC_REC',
      order_id: invoiceId,
      status_id: '1',
      hash_value: hash,
    })

    expect(result.handled).toBe(true)

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
    expect(invoice?.status).toBe('PAID')

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    expect(payment?.status).toBe('PAID')
  })

  it('rejects a callback with an invalid hash', async () => {
    const result = await reconcilePayment({
      billcode: 'BC_REC',
      order_id: invoiceId,
      status_id: '1',
      hash_value: 'tampered_hash',
    })

    expect(result.handled).toBe(false)

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
    expect(invoice?.status).toBe('ISSUED')
  })

  it('is idempotent on a duplicate paid callback', async () => {
    const hash = makeHash(SECRET, 'BC_REC', invoiceId, '1')
    await reconcilePayment({ billcode: 'BC_REC', order_id: invoiceId, status_id: '1', hash_value: hash })
    // Second call should still report handled without error.
    const second = await reconcilePayment({ billcode: 'BC_REC', order_id: invoiceId, status_id: '1', hash_value: hash })
    expect(second.handled).toBe(true)

    const payments = await prisma.payment.count({ where: { invoiceId } })
    expect(payments).toBe(1)
  })
})