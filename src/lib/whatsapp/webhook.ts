import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from '../prisma'
import type { DeliveryStatus } from '../../generated/prisma/client'

const META_STATUS_MAP: Record<string, DeliveryStatus> = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
}

/**
 * Verifies the X-Hub-Signature-256 header from Meta against a computed HMAC
 * of the raw body using the app secret. Uses a timing-safe comparison.
 */
export function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader) return false
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(signatureHeader)
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}

/**
 * Updates a MessageLog's delivery status. No-op if the message log does not
 * exist.
 */
export async function handleDeliveryStatus(
  messageLogId: string,
  status: DeliveryStatus
): Promise<void> {
  await prisma.messageLog.update({
    where: { id: messageLogId },
    data: { status },
  })
}

/**
 * Maps a Meta status string to the DeliveryStatus enum, or undefined if
 * unknown.
 */
export function mapMetaStatus(status: string): DeliveryStatus | undefined {
  return META_STATUS_MAP[status]
}

/**
 * Looks up a MessageLog by its provider message id (for webhook
 * reconciliation), returning null if not found.
 */
export async function findMessageLogByProviderId(
  providerMessageId: string
): Promise<{ id: string } | null> {
  return prisma.messageLog.findFirst({
    where: { providerMessageId },
    select: { id: true },
  })
}