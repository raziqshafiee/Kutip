import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../prisma'
import { runDailySweep } from '../invoice/sweep'

describe('invoice sweep (integration)', () => {
  beforeEach(async () => {
    await prisma.messageLog.deleteMany()
    await prisma.reminderJob.deleteMany()
    await prisma.payment.deleteMany()
    await prisma.invoice.deleteMany()
    await prisma.client.deleteMany()
    await prisma.billingRule.deleteMany()
    await prisma.business.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates invoices for due clients and enqueues T-3/T0 reminders', async () => {
    const business = await prisma.business.create({
      data: { clerkOrgId: 'org_sweep', name: 'Sweep Tenant' },
    })

    // Due on the 15th
    await prisma.client.create({
      data: {
        tenantId: business.id,
        name: 'Due Client',
        phoneE164: '+60123456789',
        billingAmount: 250,
        billingCycleDay: 15,
      },
    })
    // Not due on the 15th
    await prisma.client.create({
      data: {
        tenantId: business.id,
        name: 'Not Due',
        phoneE164: '+60129876543',
        billingAmount: 100,
        billingCycleDay: 2,
      },
    })

    const result = await runDailySweep(new Date('2026-08-15'))

    expect(result.invoicesCreated).toBe(1)

    const invoices = await prisma.invoice.findMany()
    expect(invoices).toHaveLength(1)
    expect(invoices[0].status).toBe('ISSUED')
    expect(invoices[0].amount.toNumber()).toBe(250)

    const reminders = await prisma.reminderJob.findMany({
      where: { invoiceId: invoices[0].id },
    })
    const stages = reminders.map((r) => r.stage).sort()
    expect(stages).toEqual(['T_0', 'T_MINUS_3'])
  })

  it('prevents duplicate monthly invoices for the same client', async () => {
    const business = await prisma.business.create({
      data: { clerkOrgId: 'org_sweep_dup', name: 'Dup Tenant' },
    })
    await prisma.client.create({
      data: {
        tenantId: business.id,
        name: 'Dup Client',
        phoneE164: '+60123456788',
        billingAmount: 99,
        billingCycleDay: 10,
      },
    })

    await runDailySweep(new Date('2026-08-10'))
    // Running again the same day must not create a second invoice (unique constraint)
    await expect(runDailySweep(new Date('2026-08-10'))).rejects.toThrow()
  })
})