'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientAction, updateClientAction } from '@/lib/clients/actions'
import type { ClientInput } from '@/lib/clients/service'

type Current = {
  name: string
  phoneE164: string
  serviceTier: string
  billingAmount: number
  billingCycleDay: number
}

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'

export function ClientForm({
  mode,
  clientId,
  current,
}: {
  mode: 'create' | 'edit'
  clientId?: string
  current?: Current
}) {
  const router = useRouter()
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(formData: FormData) {
    setPending(true)
    setStatus(null)

    const input: ClientInput = {
      name: String(formData.get('name') ?? ''),
      phoneE164: String(formData.get('phoneE164') ?? ''),
      serviceTier: String(formData.get('serviceTier') ?? ''),
      billingAmount: Number(formData.get('billingAmount') ?? 0),
      billingCycleDay: Number(formData.get('billingCycleDay') ?? 1),
    }

    const result =
      mode === 'create'
        ? await createClientAction(input)
        : await updateClientAction(clientId as string, input)

    if (result.ok) {
      router.push('/dashboard/clients')
    } else {
      setStatus({ ok: false, message: result.error })
      setPending(false)
    }
  }

  return (
    <form
      action={onSubmit}
      className="mt-8 space-y-6 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
    >
      <label className="block">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Name</span>
        <input name="name" className={inputClass} defaultValue={current?.name} required />
      </label>
      <label className="block">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Phone (E.164)</span>
        <input
          name="phoneE164"
          className={inputClass}
          defaultValue={current?.phoneE164}
          placeholder="+60123456789"
          required
        />
      </label>
      <label className="block">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Service Tier (optional)</span>
        <input name="serviceTier" className={inputClass} defaultValue={current?.serviceTier} />
      </label>
      <label className="block">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Billing Amount (MYR)</span>
        <input
          name="billingAmount"
          type="number"
          min={0.01}
          step="0.01"
          className={inputClass}
          defaultValue={current?.billingAmount}
          required
        />
      </label>
      <label className="block">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Billing Cycle Day (1–31)</span>
        <input
          name="billingCycleDay"
          type="number"
          min={1}
          max={31}
          className={inputClass}
          defaultValue={current?.billingCycleDay}
          required
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-zinc-900 px-5 py-3 text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : mode === 'create' ? 'Add Client' : 'Save Changes'}
      </button>
      {status && <p className="text-sm text-red-600">{status.message}</p>}
    </form>
  )
}
