import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createPaymentForInvoice } from '@/lib/payments/checkout'

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>
}) {
  const { invoiceId } = await params

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      client: true,
      business: true,
    },
  })

  const paid = invoice.status === 'PAID'

  async function payAction() {
    'use server'
    const { paymentUrl } = await createPaymentForInvoice(invoiceId)
    redirect(paymentUrl)
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{invoice.business.name}</h1>
      <div className="mt-6 rounded-lg border border-zinc-200 p-6">
        <p className="text-zinc-600">Invoice for</p>
        <p className="text-lg font-medium">{invoice.client.name}</p>
        <p className="mt-4 text-sm text-zinc-500">
          Due {invoice.dueDate.toISOString().slice(0, 10)}
        </p>
        <p className="mt-2 text-3xl font-semibold">RM {invoice.amount.toNumber().toFixed(2)}</p>
      </div>
      {paid ? (
        <p className="mt-6 text-green-600">This invoice has been paid. Thank you!</p>
      ) : (
        <form action={payAction} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-full bg-zinc-900 px-5 py-3 text-white"
          >
            Pay Now
          </button>
        </form>
      )}
    </main>
  )
}