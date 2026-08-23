import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../prisma'
import { createInvoiceForClient, transitionInvoice, IllegalTransitionError, markOverdue } from '../invoice/service'

describe('invoice service (integration)', () => {
  let businessId: string
  let clientId: string

  beforeEach(async () => {
    await prisma.messageLog.deleteMany()
    await prisma.reminderJob.deleteMany()
    await prisma.payment.deleteMany()
    await prisma.invoice.deleteMany()
    await prisma.client.deleteMany()
    await prisma.billingRule.deleteMany()
    await prisma.business.deleteMany()

    const business = await prisma.business.create({
      data: { clerkOrgId: 'org_service', name: 'Service Tenant' },
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
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates an invoice as ISSUED via DRAFT -> ISSUED', async () => {
    const invoice = await createInvoiceForClient(
      { id: clientId, tenantId: businessId } as any,
      { amount: 150, dueDate: new Date('2026-08-15') }
    )
    expect(invoice.status).toBe('ISSUED')
    expect(invoice.amount.toNumber()).toBe(150)
  })

  it('enforces illegal transitions with an error', async () => {
    const invoice = await createInvoiceForClient(
      { id: clientId, tenantId: businessId } as any,
      { amount: 150, dueDate: new Date('2026-08-15') }
    )
    // ISSUED -> PAID is legal
    const paid = await transitionInvoice(invoice.id, 'PAID')
    expect(paid.status).toBe('PAID')
    // PAID -> OVERDUE is illegal
    await expect(transitionInvoice(invoice.id, 'OVERDUE')).rejects.toBeInstanceOf(IllegalTransitionError)
  })

  it('marks an overdue invoice only after due date plus grace period', async () => {
    // due date in the past, no grace period -> should become OVERDUE
    const invoice = await createInvoiceForClient(
      { id: clientId, tenantId: businessId } as any,
      { amount: 150, dueDate: new Date('2020-01-01') }
    )
    const overdue = await markOverdue(invoice.id)
    expect(overdue?.status).toBe('OVERDUE')
  })

  it('does not mark a future-due invoice as overdue', async () => {
    const invoice = await createInvoiceForClient(
      { id: clientId, tenantId: businessId } as any,
      { amount: 150, dueDate: new Date('2999-01-01') }
    )
    const result = await markOverdue(invoice.id)
    expect(result).toBeNull()
  })
})