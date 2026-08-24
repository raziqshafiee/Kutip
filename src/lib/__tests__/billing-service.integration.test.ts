import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../prisma'
import { getBillingRuleForTenant, upsertBillingRuleForTenant } from '../billing/service'

describe('billing rule service (tenant-scoped)', () => {
  beforeEach(async () => {
    await prisma.client.deleteMany()
    await prisma.billingRule.deleteMany()
    await prisma.business.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('returns null when no billing rule exists yet', async () => {
    const business = await prisma.business.create({
      data: { clerkOrgId: 'org_none', name: 'None Co' },
    })

    const rule = await getBillingRuleForTenant(business.id)

    expect(rule).toBeNull()
  })

  it('creates a billing rule on first upsert', async () => {
    const business = await prisma.business.create({
      data: { clerkOrgId: 'org_first', name: 'First Co' },
    })

    const result = await upsertBillingRuleForTenant(business.id, {
      frequency: 'MONTHLY',
      gracePeriodDays: 3,
      lateFeeAmount: 10,
    })

    expect(result.ok).toBe(true)
    const rule = await getBillingRuleForTenant(business.id)
    expect(rule?.frequency).toBe('MONTHLY')
    expect(rule?.gracePeriodDays).toBe(3)
    expect(rule?.lateFeeAmount?.toNumber()).toBe(10)
  })

  it('updates the existing billing rule on a second upsert instead of creating a new row', async () => {
    const business = await prisma.business.create({
      data: { clerkOrgId: 'org_second', name: 'Second Co' },
    })

    await upsertBillingRuleForTenant(business.id, { frequency: 'MONTHLY', gracePeriodDays: 3 })
    await upsertBillingRuleForTenant(business.id, { frequency: 'QUARTERLY', gracePeriodDays: 7 })

    const rules = await prisma.billingRule.findMany({ where: { tenantId: business.id } })
    expect(rules).toHaveLength(1)
    expect(rules[0].frequency).toBe('QUARTERLY')
    expect(rules[0].gracePeriodDays).toBe(7)
  })

  it('rejects an invalid frequency without writing to the database', async () => {
    const business = await prisma.business.create({
      data: { clerkOrgId: 'org_invalid_freq', name: 'Invalid Freq Co' },
    })

    const result = await upsertBillingRuleForTenant(business.id, {
      frequency: 'YEARLY' as never,
      gracePeriodDays: 0,
    })

    expect(result.ok).toBe(false)
    const rule = await getBillingRuleForTenant(business.id)
    expect(rule).toBeNull()
  })
})
