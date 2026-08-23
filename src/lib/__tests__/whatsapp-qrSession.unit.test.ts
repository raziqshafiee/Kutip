import { describe, it, expect } from 'vitest'
import {
  sendViaQrSession,
  registerQrSocket,
  unregisterQrSocket,
  sendViaQrSessionForBusiness,
} from '../whatsapp/qrSession'
import type { QrSocketLike } from '../whatsapp/qrSession'

describe('sendViaQrSession', () => {
  it('sends a text message to the E.164-derived jid', async () => {
    let sentJid = ''
    let sentText = ''
    const socket: QrSocketLike = {
      sendMessage: async (jid, content) => {
        sentJid = jid
        sentText = content.text ?? ''
        return {}
      },
    }

    const result = await sendViaQrSession(socket, '+60123456789', 'Hello')
    expect(result.success).toBe(true)
    expect(sentJid).toBe('60123456789@s.whatsapp.net')
    expect(sentText).toBe('Hello')
  })

  it('returns failure when the socket throws', async () => {
    const socket: QrSocketLike = {
      sendMessage: async () => {
        throw new Error('socket closed')
      },
    }
    const result = await sendViaQrSession(socket, '+60123456789', 'Hi')
    expect(result.success).toBe(false)
    expect(result.error).toContain('socket closed')
  })
})

describe('sendViaQrSessionForBusiness', () => {
  it('fails when no QR session is configured', async () => {
    const result = await sendViaQrSessionForBusiness({ qrSessionId: null }, '+60123456789', 'Hi')
    expect(result.success).toBe(false)
    expect(result.error).toBe('No QR session configured')
  })

  it('fails when the socket is not connected', async () => {
    const result = await sendViaQrSessionForBusiness({ qrSessionId: 'nonexistent' }, '+60123456789', 'Hi')
    expect(result.success).toBe(false)
    expect(result.error).toBe('QR socket not connected')
  })

  it('sends over a registered socket', async () => {
    const sent: string[] = []
    const socket: QrSocketLike = {
      sendMessage: async (jid, content) => {
        sent.push(`${jid}:${content.text}`)
        return {}
      },
    }
    registerQrSocket('session_1', socket)

    const result = await sendViaQrSessionForBusiness({ qrSessionId: 'session_1' }, '+60123456789', 'Yo')
    expect(result.success).toBe(true)
    expect(sent).toEqual(['60123456789@s.whatsapp.net:Yo'])

    unregisterQrSocket('session_1')
  })
})