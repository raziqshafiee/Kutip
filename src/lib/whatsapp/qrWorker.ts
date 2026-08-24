import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { prisma } from '../prisma'
import { registerQrSocket, unregisterQrSocket } from './qrSession'
import type { QrSocketLike } from './qrSession'

const QR_AUTH_DIR = process.env.QR_AUTH_DIR ?? './qr-sessions'

// Holds the latest QR string for each business so a linking surface can
// display it. Keyed by qrSessionId.
const pendingQr = new Map<string, string>()

export function getPendingQr(qrSessionId: string): string | undefined {
  return pendingQr.get(qrSessionId)
}

export function clearPendingQr(qrSessionId: string): void {
  pendingQr.delete(qrSessionId)
}

async function connectBusinessQr(business: { id: string; qrSessionId: string | null }): Promise<void> {
  if (!business.qrSessionId) return

  const { state, saveCreds } = await useMultiFileAuthState(
    `${QR_AUTH_DIR}/${business.qrSessionId}`
  )

  const sock = makeWASocket({ auth: state, printQRInTerminal: true })

  registerQrSocket(business.qrSessionId, sock as unknown as QrSocketLike)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      pendingQr.set(business.qrSessionId!, qr)
    }

    if (connection === 'open') {
      clearPendingQr(business.qrSessionId!)
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      unregisterQrSocket(business.qrSessionId!)
      if (shouldReconnect) {
        // Reconnect after a short delay.
        setTimeout(() => connectBusinessQr(business), 5000)
      }
    }
  })
}

/**
 * Connects persistent Baileys sockets for every QR-session-enabled business.
 * Call once at worker startup. Sockets persist per number; session state is
 * written to the QR_AUTH_DIR volume.
 */
export async function startQrWorkers(): Promise<void> {
  const businesses = await prisma.business.findMany({
    where: { whatsappChannel: 'QR_SESSION' },
    select: { id: true, qrSessionId: true },
  })

  for (const business of businesses) {
    try {
      await connectBusinessQr(business)
    } catch (err) {
      console.error(`[qr] failed to connect ${business.id}:`, err)
    }
  }
}