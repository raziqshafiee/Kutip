import { NextRequest, NextResponse } from 'next/server'
import { reconcilePayment } from '@/lib/payments/reconcile'
import type { ToyyibPayCallback } from '@/lib/payments/reconcile'

/**
 * ToyyibPay payment callback endpoint. The gateway POSTs here after a bill
 * is paid; reconciliation verifies the signature and flips the invoice.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const payload = (await req.json()) as ToyyibPayCallback

  const result = await reconcilePayment(payload)
  if (!result.handled) {
    return new NextResponse('Rejected', { status: 400 })
  }
  return new NextResponse('OK', { status: 200 })
}