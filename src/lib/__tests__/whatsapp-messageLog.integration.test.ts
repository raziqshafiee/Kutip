import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../prisma'
import {
  createMessageLog,
  markMessageSent,
  markMessageDelivered,
  markMessageFailed,
} from '../whatsapp/messageLog'

describe('message log (integration)', () => {
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
      data: { clerkOrgId: 'org_msg', name: 'Msg Tenant' },
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
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates a message log in QUEUED then advances to SENT/DELIVERED', async () => {
    const log = await createMessageLog({
      invoiceId,
      channel: 'WHATSAPP_CLOUD_API',
      template: 'invoice_reminder',
    })
    expect(log.status).toBe('QUEUED')

    const sent = await markMessageSent(log.id)
    expect(sent.status).toBe('SENT')

    const delivered = await markMessageDelivered(log.id)
    expect(delivered.status).toBe('DELIVERED')
  })

  it('marks a message log FAILED', async () => {
    const log = await createMessageLog({
      invoiceId,
      channel: 'WHATSAPP_QR_SESSION',
      template: 'reminder',
    })
    const failed = await markMessageFailed(log.id)
    expect(failed.status).toBe('FAILED')
  })
})