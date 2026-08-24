import { prisma } from '../prisma'
import type { InvoiceStatus } from '../../generated/prisma/client'

export type PipelineMetrics = {
  expected: number
  collected: number
  pending: number
  defaultRisk: number
  invoiceCount: number
}

/**
 * Classifies an invoice status into one of the four pipeline buckets.
 * Exported for unit testing.
 */
export function classifyStatus(status: InvoiceStatus): 'expected' | 'collected' | 'pending' | 'defaultRisk' | 'ignored' {
  switch (status) {
    case 'PAID':
      return 'collected'
    case 'ISSUED':
      return 'pending'
    case 'OVERDUE':
      return 'defaultRisk'
    case 'DRAFT':
    case 'ARCHIVED':
      return 'ignored'
    default:
      return 'ignored'
  }
}

/**
 * Aggregates a tenant's invoices into the financial pipeline metrics.
 * - expected: everything billed and still live (pending + overdue + collected)
 * - collected: PAID
 * - pending: ISSUED (not yet overdue)
 * - defaultRisk: OVERDUE
 */
export async function computePipelineMetrics(tenantId: string): Promise<PipelineMetrics> {
  const invoices = await prisma.invoice.findMany({
    where: { tenantId },
    select: { amount: true, status: true },
  })

  const metrics: PipelineMetrics = {
    expected: 0,
    collected: 0,
    pending: 0,
    defaultRisk: 0,
    invoiceCount: 0,
  }

  for (const invoice of invoices) {
    const amount = invoice.amount.toNumber()
    const bucket = classifyStatus(invoice.status)

    if (bucket === 'ignored') {
      continue
    }

    metrics.invoiceCount += 1

    // expected = total of all live (non-draft, non-archived) invoices
    metrics.expected += amount

    if (bucket === 'collected') metrics.collected += amount
    if (bucket === 'pending') metrics.pending += amount
    if (bucket === 'defaultRisk') metrics.defaultRisk += amount
  }

  return metrics
}