import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../prisma'
import {
  createClientForTenant,
  updateClientForTenant,
  deleteClientForTenant,
  listClientsForTenant,
} from '../clients/service'

describe('client service (tenant-scoped)', () => {
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

  it('creates a client scoped to the given tenant', async () => {
    const business = await prisma.business.create({
      data: { clerkOrgId: 'org_create', name: 'Create Co' },
    })

    const result = await createClientForTenant(business.id, {
      name: 'Ali',
      phoneE164: '+60123456789',
      billingAmount: 150,
      billingCycleDay: 1,
    })

    expect(result.ok).toBe(true)
    const clients = await listClientsForTenant(business.id)
    expect(clients).toHaveLength(1)
    expect(clients[0].name).toBe('Ali')
  })

  it('rejects creating a client with an invalid phone number', async () => {
    const business = await prisma.business.create({
      data: { clerkOrgId: 'org_invalid', name: 'Invalid Co' },
    })

    const result = await createClientForTenant(business.id, {
      name: 'Bad Phone',
      phoneE164: '0123456789',
      billingAmount: 100,
      billingCycleDay: 1,
    })

    expect(result).toEqual({
      ok: false,
      error: 'Phone number must be in E.164 format (e.g. +60123456789)',
    })
  })

  it('updates a client belonging to the tenant', async () => {
    const business = await prisma.business.create({
      data: { clerkOrgId: 'org_update', name: 'Update Co' },
    })
    const client = await prisma.client.create({
      data: {
        tenantId: business.id,
        name: 'Old Name',
        phoneE164: '+60123456789',
        billingAmount: 100,
        billingCycleDay: 1,
      },
    })

    const result = await updateClientForTenant(business.id, client.id, {
      name: 'New Name',
      phoneE164: '+60123456789',
      billingAmount: 200,
      billingCycleDay: 15,
    })

    expect(result.ok).toBe(true)
    const updated = await prisma.client.findUniqueOrThrow({ where: { id: client.id } })
    expect(updated.name).toBe('New Name')
    expect(updated.billingAmount.toNumber()).toBe(200)
  })

  it('rejects updating a client belonging to a different tenant', async () => {
    const businessA = await prisma.business.create({
      data: { clerkOrgId: 'org_a_update', name: 'A Co' },
    })
    const businessB = await prisma.business.create({
      data: { clerkOrgId: 'org_b_update', name: 'B Co' },
    })
    const client = await prisma.client.create({
      data: {
        tenantId: businessA.id,
        name: 'Ali',
        phoneE164: '+60123456789',
        billingAmount: 100,
        billingCycleDay: 1,
      },
    })

    const result = await updateClientForTenant(businessB.id, client.id, {
      name: 'Hijacked',
      phoneE164: '+60123456789',
      billingAmount: 999,
      billingCycleDay: 1,
    })

    expect(result).toEqual({ ok: false, error: 'Client not found' })
  })

  it('deletes a client with no invoices', async () => {
    const business = await prisma.business.create({
      data: { clerkOrgId: 'org_delete', name: 'Delete Co' },
    })
    const client = await prisma.client.create({
      data: {
        tenantId: business.id,
        name: 'Ali',
        phoneE164: '+60123456789',
        billingAmount: 100,
        billingCycleDay: 1,
      },
    })

    const result = await deleteClientForTenant(business.id, client.id)

    expect(result.ok).toBe(true)
    const remaining = await listClientsForTenant(business.id)
    expect(remaining).toHaveLength(0)
  })

  it('blocks deleting a client that has billing history', async () => {
    const business = await prisma.business.create({
      data: { clerkOrgId: 'org_delete_blocked', name: 'Delete Blocked Co' },
    })
    const client = await prisma.client.create({
      data: {
        tenantId: business.id,
        name: 'Ali',
        phoneE164: '+60123456789',
        billingAmount: 100,
        billingCycleDay: 1,
      },
    })
    await prisma.invoice.create({
      data: {
        tenantId: business.id,
        clientId: client.id,
        amount: 100,
        dueDate: new Date(),
      },
    })

    const result = await deleteClientForTenant(business.id, client.id)

    expect(result).toEqual({
      ok: false,
      error: 'This client has billing history and cannot be deleted',
    })
    const remaining = await listClientsForTenant(business.id)
    expect(remaining).toHaveLength(1)
  })
})
