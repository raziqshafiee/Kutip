import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../prisma'
import { computePipelineMetrics } from '../dashboard/metrics'

describe('computePipelineMetrics (integration)', () => {
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
      data: { clerkOrgId: 'org_metrics', name: 'Metrics Tenant' },
    })
    businessId = business.id
    const client = await prisma.client.create({
      data: {
        tenantId: business.id,
        name: 'Alya',
        phoneE164: '+60123456789',
        billingAmount: 100,
        billingCycleDay: 15,
      },
    })
    clientId = client.id
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('aggregates invoices into expected/collected/pending/defaultRisk', async () => {
    // 100 paid, 50 pending (issued), 200 overdue
    await prisma.invoice.createMany({
      data: [
        { tenantId: businessId, clientId, amount: 100, dueDate: new Date('2026-08-15'), status: 'PAID' },
        { tenantId: businessId, clientId, amount: 50, dueDate: new Date('2026-09-15'), status: 'ISSUED' },
        { tenantId: businessId, clientId, amount: 200, dueDate: new Date('2026-10-15'), status: 'OVERDUE' },
      ],
    })

    const metrics = await computePipelineMetrics(businessId)

    expect(metrics.collected).toBe(100)
    expect(metrics.pending).toBe(50)
    expect(metrics.defaultRisk).toBe(200)
    expect(metrics.expected).toBe(350)
    expect(metrics.invoiceCount).toBe(3)
  })
})