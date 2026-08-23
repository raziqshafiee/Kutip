import { createHash } from 'node:crypto'
import type { Business } from '../../generated/prisma/client'

const BASE = 'https://toyyibpay.com/index.php/api'
const DEV_BASE = 'https://dev.toyyibpay.com/index.php/api'

function apiBase(business: Pick<Business, 'toyyibpaySandbox'>): string {
  return business.toyyibpaySandbox === false ? BASE : DEV_BASE
}

export type CreateBillResult = {
  billCode: string
  paymentUrl: string
}

/**
 * Creates a ToyyibPay bill for an invoice and returns the BillCode and the
 * hosted payment URL. Uses form-encoded POST per the ToyyibPay API.
 */
export async function createBill(
  business: Pick<
    Business,
    | 'toyyibpayUserSecretKey'
    | 'toyyibpayCategoryCode'
    | 'toyyibpaySandbox'
    | 'name'
  >,
  invoice: { id: string; amount: { toNumber(): number }; dueDate: Date },
  opts: { billTo: string; callbackUrl: string; returnUrl: string }
): Promise<CreateBillResult> {
  if (!business.toyyibpayUserSecretKey || !business.toyyibpayCategoryCode) {
    throw new Error('ToyyibPay credentials not configured')
  }

  const body = new URLSearchParams()
  body.set('userSecretKey', business.toyyibpayUserSecretKey)
  body.set('categoryCode', business.toyyibpayCategoryCode)
  body.set('billName', `Invoice ${invoice.id}`)
  body.set('billDescription', `${business.name} invoice`)
  body.set('billAmount', invoice.amount.toNumber().toFixed(2))
  body.set('billTo', opts.billTo)
  body.set('billEmail', opts.billTo)
  body.set('billPhone', opts.billTo)
  body.set('billReturnUrl', opts.returnUrl)
  body.set('billCallbackUrl', opts.callbackUrl)
  body.set('billExternalReferenceNo', invoice.id)

  const res = await fetch(`${apiBase(business)}/createBill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    throw new Error(`ToyyibPay createBill error ${res.status}: ${await res.text()}`)
  }

  const data = (await res.json()) as Array<{ BillCode?: string }>
  const billCode = data?.[0]?.BillCode
  if (!billCode) {
    throw new Error('ToyyibPay createBill returned no BillCode')
  }

  const host = business.toyyibpaySandbox === false ? 'toyyibpay.com' : 'dev.toyyibpay.com'
  return { billCode, paymentUrl: `https://${host}/${billCode}` }
}

/**
 * Verifies ToyyibPay's callback hash_value. ToyyibPay computes
 * SHA1(billcode + order_id + status_id) keyed with the user secret key;
 * the exact concatenation should match the merchant's integration settings.
 */
export function verifyCallbackHash(
  receivedHash: string,
  fields: { billcode: string; order_id: string; status_id: string },
  userSecretKey: string
): boolean {
  // ToyyibPay hash_value is SHA1 of the secret key + billcode + order_id + status_id.
  const raw = `${userSecretKey}${fields.billcode}${fields.order_id}${fields.status_id}`
  const expected = createHash('sha1').update(raw).digest('hex')
  return expected === receivedHash
}