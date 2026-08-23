import { NextRequest, NextResponse } from 'next/server'
import {
  verifySignature,
  mapMetaStatus,
  handleDeliveryStatus,
  findMessageLogByProviderId,
} from '@/lib/whatsapp/webhook'

/**
 * Meta webhook verification handshake (GET).
 * Meta sends hub.mode=subscribe, hub.verify_token, hub.challenge.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

/**
 * Meta delivery-status callback (POST). Verifies the signature, then
 * reconciles each status entry to the matching MessageLog by provider id.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const appSecret = process.env.WHATSAPP_WEBHOOK_SECRET
  if (!appSecret) {
    return new NextResponse('Webhook secret not configured', { status: 500 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256')

  if (!verifySignature(rawBody, signature, appSecret)) {
    return new NextResponse('Invalid signature', { status: 403 })
  }

  const payload = JSON.parse(rawBody) as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          statuses?: Array<{
            id: string
            status: string
          }>
        }
      }>
    }>
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        const deliveryStatus = mapMetaStatus(status.status)
        if (!deliveryStatus) continue
        const log = await findMessageLogByProviderId(status.id)
        if (log) {
          await handleDeliveryStatus(log.id, deliveryStatus)
        }
      }
    }
  }

  return new NextResponse('OK', { status: 200 })
}