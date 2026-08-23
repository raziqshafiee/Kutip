import { prisma } from '../prisma'
import type { Business, MessageChannel } from '../../generated/prisma/client'
import { buildReminderPayload } from './templates'
import { createMessageLog, markMessageSent, markMessageSentWithProvider, markMessageFailed } from './messageLog'

const GRAPH_BASE = 'https://graph.facebook.com/v19.0'

function whatsappChannelToMessageChannel(
  channel: Business['whatsappChannel']
): MessageChannel {
  return channel === 'QR_SESSION' ? 'WHATSAPP_QR_SESSION' : 'WHATSAPP_CLOUD_API'
}

export type SendResult = {
  success: boolean
  messageId?: string
  error?: string
}

function toRecipient(phoneE164: string): string {
  // Meta expects a plain digit number without the leading '+'
  return phoneE164.replace(/^\+/, '')
}

/**
 * Sends a text message via the Meta WhatsApp Cloud API using the business's
 * stored credentials. Returns success and the provider message id on success.
 */
export async function sendViaCloudApi(
  business: Pick<Business, 'cloudApiPhoneNumberId' | 'cloudApiAccessToken'>,
  toE164: string,
  text: string
): Promise<SendResult> {
  const phoneNumberId = business.cloudApiPhoneNumberId
  const token = business.cloudApiAccessToken

  if (!phoneNumberId || !token) {
    return { success: false, error: 'Missing Cloud API credentials' }
  }

  const url = `${GRAPH_BASE}/${phoneNumberId}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to: toRecipient(toE164),
    type: 'text',
    text: { body: text },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    return { success: false, error: `Cloud API error ${res.status}: ${await res.text()}` }
  }

  const data = (await res.json()) as { messages?: { id: string }[] }
  return {
    success: true,
    messageId: data.messages?.[0]?.id,
  }
}

/**
 * Orchestrates dispatch of a reminder to a client's WhatsApp via the
 * business's configured channel. Skips if no channel is configured.
 *
 * Flow: load payload -> create MessageLog (QUEUED) -> send -> mark SENT/FAILED.
 */
export async function dispatchReminder(
  invoiceId: string,
  stage: string
): Promise<{ sent: boolean }> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      client: {
        include: { business: true },
      },
    },
  })

  const business = invoice.client.business

  if (business.whatsappChannel === 'NONE') {
    return { sent: false }
  }

  const payload = await buildReminderPayload(invoiceId, stage)
  const rendered = payload.text.replace(
    /\{\{(\w+)\}\}/g,
    (m, key: string) => payload.vars[key as keyof typeof payload.vars] ?? m
  )

  const log = await createMessageLog({
    invoiceId,
    channel: whatsappChannelToMessageChannel(business.whatsappChannel),
    template: 'invoice_reminder',
  })

  if (business.whatsappChannel === 'CLOUD_API') {
    const result = await sendViaCloudApi(business, invoice.client.phoneE164, rendered)
    if (result.success) {
      if (result.messageId) {
        await markMessageSentWithProvider(log.id, result.messageId)
      } else {
        await markMessageSent(log.id)
      }
      return { sent: true }
    }
    await markMessageFailed(log.id)
    return { sent: false }
  }

  // QR_SESSION handled by the QR worker in Task 6.
  return { sent: false }
}