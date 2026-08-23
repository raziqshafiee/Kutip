import { prisma } from '../prisma'
import type {
  Invoice,
  InvoiceStatus,
  Client,
} from '../../generated/prisma/client'
import type { DueInvoiceInput } from './generator'

const LEGAL_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ['ISSUED'],
  ISSUED: ['PAID', 'OVERDUE', 'ARCHIVED'],
  PAID: [],
  OVERDUE: ['PAID', 'ARCHIVED'],
  ARCHIVED: [],
}

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to)
}

export class IllegalTransitionError extends Error {
  constructor(from: InvoiceStatus, to: InvoiceStatus) {
    super(`Illegal invoice transition: ${from} -> ${to}`)
    this.name = 'IllegalTransitionError'
  }
}

/**
 * Creates an invoice for a client in DRAFT then flips it to ISSUED.
 * A unique (clientId, dueDate) constraint prevents duplicate monthly
 * invoices for the same client.
 */
export async function createInvoiceForClient(
  client: Client,
  input: DueInvoiceInput
): Promise<Invoice> {
  const draft = await prisma.invoice.create({
    data: {
      tenantId: client.tenantId,
      clientId: client.id,
      amount: input.amount,
      dueDate: input.dueDate,
      status: 'DRAFT',
    },
  })

  return transitionInvoice(draft.id, 'ISSUED')
}

/**
 * Transitions an invoice between legal states, throwing on illegal moves.
 */
export async function transitionInvoice(
  invoiceId: string,
  toStatus: InvoiceStatus
): Promise<Invoice> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
  })

  if (!canTransition(invoice.status, toStatus)) {
    throw new IllegalTransitionError(invoice.status, toStatus)
  }

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: toStatus },
  })
}

/**
 * Marks an ISSUED invoice as OVERDUE once its due date plus the tenant's
 * grace period has passed. No-op-safe for invoices not in ISSUED state.
 */
export async function markOverdue(invoiceId: string): Promise<Invoice | null> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      client: {
        include: { business: true },
      },
    },
  })

  if (invoice.status !== 'ISSUED') {
    return null
  }

  const billingRule = await prisma.billingRule.findFirst({
    where: { tenantId: invoice.tenantId },
  })

  const gracePeriodDays = billingRule?.gracePeriodDays ?? 0
  const cutoff = new Date(invoice.dueDate)
  cutoff.setDate(cutoff.getDate() + gracePeriodDays)

  if (new Date() <= cutoff) {
    return null
  }

  return transitionInvoice(invoiceId, 'OVERDUE')
}