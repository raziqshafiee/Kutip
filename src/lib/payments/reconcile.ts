import { prisma } from '../prisma'
import { verifyCallbackHash } from './toyyibpay'
import { generateReceiptPdf } from '../invoice/pdf'
import { dispatchPaymentConfirmation } from './receiptDispatch'

export type ToyyibPayCallback = {
  billcode: string
  order_id: string
  status_id: string
  transaction_id?: string
  hash_value: string
}

/**
 * Reconciles a ToyyibPay payment callback. Verifies the hash, finds the
 * matching Payment by bill code, flips the invoice to PAID (idempotently),
 * records the Payment, and generates the receipt PDF.
 *
 * Returns false for tampered/unverifiable callbacks.
 */
export async function reconcilePayment(
  payload: ToyyibPayCallback
): Promise<{ handled: boolean }> {
  const payment = await prisma.payment.findFirst({
    where: { billCode: payload.billcode },
    include: {
      invoice: {
        include: { business: true },
      },
    },
  })

  if (!payment) {
    return { handled: false }
  }

  const secretKey = payment.invoice.business.toyyibpayUserSecretKey
  if (!secretKey) {
    return { handled: false }
  }

  // Verify signature before any side effect.
  const valid = verifyCallbackHash(payload.hash_value, {
    billcode: payload.billcode,
    order_id: payload.order_id,
    status_id: payload.status_id,
  }, secretKey)

  if (!valid) {
    return { handled: false }
  }

  const success = payload.status_id === '1'

  // Idempotent: if already PAID, nothing more to do.
  if (payment.invoice.status === 'PAID') {
    return { handled: true }
  }

  if (!success) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', hashValue: payload.hash_value },
    })
    return { handled: true }
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'PAID', hashValue: payload.hash_value },
    }),
    prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: { status: 'PAID' },
    }),
  ])

  // Generate the receipt PDF and dispatch the WhatsApp confirmation.
  await generateReceiptPdf(payment.id)
  await dispatchPaymentConfirmation(payment.id)

  return { handled: true }
}