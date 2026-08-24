import type { Business } from '../../generated/prisma/client'

/**
 * Minimal shape of a WhatsApp socket that `sendViaQrSession` needs.
 * Baileys sockets satisfy this; tests can supply a fake.
 */
export type QrSocketLike = {
  sendMessage: (
    jid: string,
    content: { text?: string },
    options?: Record<string, unknown>
  ) => Promise<unknown>
}

function toJid(phoneE164: string): string {
  return `${phoneE164.replace(/^\+/, '')}@s.whatsapp.net`
}

/**
 * Sends a text message over a given QR-session socket.
 * Extracted as a pure function so it can be tested with a fake socket.
 */
export async function sendViaQrSession(
  socket: QrSocketLike,
  toE164: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await socket.sendMessage(toJid(toE164), { text })
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * In-memory registry mapping a business's qrSessionId to its live socket.
 * Populated by the QR worker (qrWorker.ts) on connect.
 */
const socketRegistry = new Map<string, QrSocketLike>()

export function registerQrSocket(qrSessionId: string, socket: QrSocketLike): void {
  socketRegistry.set(qrSessionId, socket)
}

export function unregisterQrSocket(qrSessionId: string): void {
  socketRegistry.delete(qrSessionId)
}

export function getQrSocket(qrSessionId: string): QrSocketLike | undefined {
  return socketRegistry.get(qrSessionId)
}

/**
 * Sends a QR-channel message for a business using its registered socket.
 * Returns failure if the business has no QR session or no live socket.
 */
export async function sendViaQrSessionForBusiness(
  business: Pick<Business, 'qrSessionId'>,
  toE164: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  if (!business.qrSessionId) {
    return { success: false, error: 'No QR session configured' }
  }
  const socket = getQrSocket(business.qrSessionId)
  if (!socket) {
    return { success: false, error: 'QR socket not connected' }
  }
  return sendViaQrSession(socket, toE164, text)
}