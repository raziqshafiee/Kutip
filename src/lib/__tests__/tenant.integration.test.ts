import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../prisma'
import { getOrCreateTenantForOrg } from '../tenant'

describe('getOrCreateTenantForOrg', () => {
  beforeEach(async () => {
    await prisma.client.deleteMany()
    await prisma.business.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates a new Business on first call for an org', async () => {
    const business = await getOrCreateTenantForOrg('org_new', 'New Tuition Center')

    expect(business.clerkOrgId).toBe('org_new')
    expect(business.name).toBe('New Tuition Center')
  })

  it('returns the existing Business on subsequent calls, updating the name', async () => {
    await getOrCreateTenantForOrg('org_repeat', 'Old Name')
    const updated = await getOrCreateTenantForOrg('org_repeat', 'New Name')

    const all = await prisma.business.findMany({ where: { clerkOrgId: 'org_repeat' } })

    expect(all).toHaveLength(1)
    expect(updated.name).toBe('New Name')
  })
})