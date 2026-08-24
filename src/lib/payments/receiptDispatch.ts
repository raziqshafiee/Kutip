import { prisma } from '../prisma'
import { generateReceiptPdf } from '../invoice/pdf'
import { sendViaCloudApi } from '../whatsapp/cloudApi'
import { sendViaQrSessionForBusiness } from '../whatsapp/qrSession'
import { createMessageLog, markMessageSent, markMessageFailed } from '../whatsapp/messageLog'

/**
 * Sends a "Payment Received — Thank You!" WhatsApp confirmation with the
 * receipt PDF after a payment is reconciled. Uses the business's configured
 * channel and records a MessageLog.
 */
export async function dispatchPaymentConfirmation(paymentId: string): Promise<{ sent: boolean }> {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      invoice: {
        include: {
          client: {
            include: { business: true },
          },
        },
      },
    },
  })

  const business = payment.invoice.client.business
  const channel = business.whatsappChannel

  if (channel === 'NONE') {
    return { sent: false }
  }

  const receipt = await generateReceiptPdf(paymentId)
  const text =
    `Thank you! Your payment of RM ${payment.amount.toNumber().toFixed(2)} ` +
    `for ${payment.invoice.client.business.name} has been received.`

  const log = await createMessageLog({
    invoiceId: payment.invoiceId,
    channel: channel === 'QR_SESSION' ? 'WHATSAPP_QR_SESSION' : 'WHATSAPP_CLOUD_API',
    template: 'payment_received',
  })

  const phone = payment.invoice.client.phoneE164

  if (channel === 'CLOUD_API') {
    const result = await sendViaCloudApi(business, phone, text)
    if (result.success) {
      if (result.messageId) {
        await prisma.messageLog.update({
          where: { id: log.id },
          data: { status: 'SENT', providerMessageId: result.messageId },
        })
      } else {
        await markMessageSent(log.id)
      }
      return { sent: true }
    }
    await markMessageFailed(log.id)
    return { sent: false }
  }

  if (channel === 'QR_SESSION') {
    const result = await sendViaQrSessionForBusiness(business, phone, text)
    if (result.success) {
      await markMessageSent(log.id)
      return { sent: true }
    }
    await markMessageFailed(log.id)
    return { sent: false }
  }

  return { sent: false }
}

/**
 * Returns the receipt PDF buffer for a payment (for attaching/downloads).
 */
export async function getReceiptPdf(paymentId: string): Promise<Buffer> {
  return generateReceiptPdf(paymentId)
}