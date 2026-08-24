import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../prisma'

describe('BillingRule schema constraints', () => {
  beforeEach(async () => {
    // Delete in order to respect foreign key constraints
    await prisma.messageLog.deleteMany()
    await prisma.reminderJob.deleteMany()
    await prisma.payment.deleteMany()
    await prisma.invoice.deleteMany()
    await prisma.billingRule.deleteMany()
    await prisma.client.deleteMany()
    await prisma.business.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('rejects a second BillingRule row for the same tenant', async () => {
    const business = await prisma.business.create({
      data: { clerkOrgId: 'org_unique_test', name: 'Unique Test Co' },
    })

    await prisma.billingRule.create({
      data: { tenantId: business.id, frequency: 'MONTHLY' },
    })

    await expect(
      prisma.billingRule.create({
        data: { tenantId: business.id, frequency: 'QUARTERLY' },
      })
    ).rejects.toThrow()
  })
})
