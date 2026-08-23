import { prisma } from '../prisma'
import { createBill } from './toyyibpay'

/**
 * Ensures a PENDING Payment exists for an unpaid invoice, creates a
 * ToyyibPay bill, stores the BillCode, and returns the hosted payment URL.
 * Throws if the invoice is already paid or the business has no gateway.
 */
export async function createPaymentForInvoice(
  invoiceId: string
): Promise<{ paymentUrl: string }> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      client: true,
      business: true,
    },
  })

  if (invoice.status === 'PAID') {
    throw new Error('Invoice already paid')
  }

  if (!invoice.business.toyyibpayUserSecretKey || !invoice.business.toyyibpayCategoryCode) {
    throw new Error('ToyyibPay credentials not configured')
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  // Create or reuse a PENDING payment for this invoice.
  const payment =
    (await prisma.payment.findFirst({
      where: { invoiceId, status: 'PENDING' },
    })) ??
    (await prisma.payment.create({
      data: {
        invoiceId,
        gatewayRef: invoiceId,
        amount: invoice.amount,
        externalRef: invoice.id,
      },
    }))

  const bill = await createBill(
    invoice.business,
    invoice,
    {
      billTo: invoice.client.name,
      callbackUrl: `${baseUrl}/api/payments/toyyibpay/webhook`,
      returnUrl: `${baseUrl}/invoices/${invoice.id}/thanks`,
    }
  )

  if (!payment.billCode || payment.billCode !== bill.billCode) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { billCode: bill.billCode },
    })
  }

  return { paymentUrl: bill.paymentUrl }
}