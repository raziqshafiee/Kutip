import { prisma } from '../prisma'
import type { MessageLog, MessageChannel, DeliveryStatus } from '../../generated/prisma/client'

export type CreateMessageLogInput = {
  invoiceId: string
  channel: MessageChannel
  template: string
  status?: DeliveryStatus
}

/**
 * Creates a MessageLog row linked to an invoice. The status defaults to
 * QUEUED and is advanced by the sender and delivery webhooks.
 */
export async function createMessageLog(
  input: CreateMessageLogInput
): Promise<MessageLog> {
  return prisma.messageLog.create({
    data: {
      invoiceId: input.invoiceId,
      channel: input.channel,
      template: input.template,
      status: input.status ?? 'QUEUED',
    },
  })
}

export async function updateMessageLogStatus(
  messageLogId: string,
  status: DeliveryStatus
): Promise<MessageLog> {
  return prisma.messageLog.update({
    where: { id: messageLogId },
    data: { status },
  })
}

export async function markMessageSent(messageLogId: string): Promise<MessageLog> {
  return updateMessageLogStatus(messageLogId, 'SENT')
}

export async function markMessageDelivered(messageLogId: string): Promise<MessageLog> {
  return updateMessageLogStatus(messageLogId, 'DELIVERED')
}

export async function markMessageRead(messageLogId: string): Promise<MessageLog> {
  return updateMessageLogStatus(messageLogId, 'READ')
}

export async function markMessageFailed(messageLogId: string): Promise<MessageLog> {
  return updateMessageLogStatus(messageLogId, 'FAILED')
}