import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../prisma'

describe('tenant scoping', () => {
  beforeEach(async () => {
    await prisma.messageLog.deleteMany()
    await prisma.reminderJob.deleteMany()
    await prisma.payment.deleteMany()
    await prisma.invoice.deleteMany()
    await prisma.client.deleteMany()
    await prisma.business.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('only returns clients belonging to the given tenant', async () => {
    const businessA = await prisma.business.create({
      data: { clerkOrgId: 'org_a', name: 'Tuition Center A' },
    })
    const businessB = await prisma.business.create({
      data: { clerkOrgId: 'org_b', name: 'Tuition Center B' },
    })

    await prisma.client.create({
      data: {
        tenantId: businessA.id,
        name: 'Ali',
        phoneE164: '+60123456789',
        billingAmount: 150,
        billingCycleDay: 1,
      },
    })
    await prisma.client.create({
      data: {
        tenantId: businessB.id,
        name: 'Siti',
        phoneE164: '+60129876543',
        billingAmount: 200,
        billingCycleDay: 15,
      },
    })

    const clientsForA = await prisma.client.findMany({
      where: { tenantId: businessA.id },
    })

    expect(clientsForA).toHaveLength(1)
    expect(clientsForA[0].name).toBe('Ali')
  })
})