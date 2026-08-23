import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../prisma'
import { findClientsDueForBilling } from '../invoice/generator'

describe('findClientsDueForBilling (integration)', () => {
  let businessA: { id: string }
  let businessB: { id: string }

  beforeEach(async () => {
    await prisma.messageLog.deleteMany()
    await prisma.reminderJob.deleteMany()
    await prisma.payment.deleteMany()
    await prisma.invoice.deleteMany()
    await prisma.client.deleteMany()
    await prisma.billingRule.deleteMany()
    await prisma.business.deleteMany()

    businessA = await prisma.business.create({
      data: { clerkOrgId: 'org_a', name: 'Tenant A' },
    })
    businessB = await prisma.business.create({
      data: { clerkOrgId: 'org_b', name: 'Tenant B' },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('only selects clients whose cycle day matches the reference day', async () => {
    await prisma.client.create({
      data: {
        tenantId: businessA.id,
        name: 'Due Today',
        phoneE164: '+60123456789',
        billingAmount: 150,
        billingCycleDay: 15,
      },
    })
    await prisma.client.create({
      data: {
        tenantId: businessA.id,
        name: 'Not Due',
        phoneE164: '+60129876543',
        billingAmount: 200,
        billingCycleDay: 3,
      },
    })
    await prisma.client.create({
      data: {
        tenantId: businessB.id,
        name: 'Other Tenant',
        phoneE164: '+60123456788',
        billingAmount: 300,
        billingCycleDay: 15,
      },
    })

    // Reference date: 2026-08-15 -> cycle day 15
    const due = await findClientsDueForBilling(businessA.id, new Date('2026-08-15'))

    expect(due).toHaveLength(1)
    expect(due[0].name).toBe('Due Today')
  })

  it('caps cycle day 31 to the last day of a 30-day month', async () => {
    await prisma.client.create({
      data: {
        tenantId: businessA.id,
        name: 'Month-End Client',
        phoneE164: '+60123456787',
        billingAmount: 99,
        billingCycleDay: 31,
      },
    })

    const due = await findClientsDueForBilling(businessA.id, new Date('2026-04-30'))

    expect(due).toHaveLength(1)
    expect(due[0].name).toBe('Month-End Client')
  })
})