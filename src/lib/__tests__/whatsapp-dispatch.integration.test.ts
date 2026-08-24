import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '../prisma'
import { dispatchReminderJob } from '../whatsapp/dispatcher'

function mockFetchOk() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => '{}',
    json: async () => ({ messages: [{ id: 'wamid_test' }] }),
  }) as unknown as typeof fetch
}

describe('reminder dispatch (integration)', () => {
  let businessId: string
  let clientId: string
  let invoiceId: string
  let reminderId: string

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
        clerkOrgId: 'org_dispatch',
        name: 'Dispatch Tenant',
        whatsappChannel: 'CLOUD_API',
        cloudApiPhoneNumberId: '111222333',
        cloudApiAccessToken: 'EAATestToken',
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
    const reminder = await prisma.reminderJob.create({
      data: {
        invoiceId: invoice.id,
        stage: 'T_0',
        scheduledFor: new Date('2026-08-15'),
        status: 'PENDING',
      },
    })
    reminderId = reminder.id

    vi.stubGlobal('fetch', mockFetchOk())
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    await prisma.$disconnect()
  })

  it('dispatches a Cloud API reminder, creating a MessageLog and marking SENT', async () => {
    const result = await dispatchReminderJob({
      invoiceId,
      stage: 'T_0',
    })

    expect(result.sent).toBe(true)

    const log = await prisma.messageLog.findFirst({ where: { invoiceId } })
    expect(log).not.toBeNull()
    expect(log?.channel).toBe('WHATSAPP_CLOUD_API')
    expect(log?.status).toBe('SENT')

    const reminder = await prisma.reminderJob.findUnique({ where: { id: reminderId } })
    expect(reminder?.status).toBe('SENT')
  })

  it('skips dispatch for a paid invoice', async () => {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID' },
    })

    const result = await dispatchReminderJob({ invoiceId, stage: 'T_0' })
    expect(result.sent).toBe(false)

    const reminder = await prisma.reminderJob.findUnique({ where: { id: reminderId } })
    expect(reminder?.status).toBe('SKIPPED')

    const logs = await prisma.messageLog.count({ where: { invoiceId } })
    expect(logs).toBe(0)
  })
})