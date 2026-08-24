'use client'

import { useState } from 'react'
import { upsertBillingRuleAction } from '@/lib/billing/actions'
import type { BillingRuleInput } from '@/lib/billing/service'

type Current = {
  frequency: 'MONTHLY' | 'QUARTERLY' | 'CUSTOM'
  gracePeriodDays: number
  lateFeeAmount?: number
}

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'

export function BillingRuleForm({ current }: { current: Current }) {
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(formData: FormData) {
    setPending(true)
    setStatus(null)

    const lateFeeRaw = String(formData.get('lateFeeAmount') ?? '').trim()

    const input: BillingRuleInput = {
      frequency: String(formData.get('frequency') ?? 'MONTHLY') as BillingRuleInput['frequency'],
      gracePeriodDays: Number(formData.get('gracePeriodDays') ?? 0),
      lateFeeAmount: lateFeeRaw === '' ? undefined : Number(lateFeeRaw),
    }

    const result = await upsertBillingRuleAction(input)

    if (result.ok) {
      setStatus({ ok: true, message: 'Billing rule saved.' })
    } else {
      setStatus({ ok: false, message: result.error })
    }
    setPending(false)
  }

  return (
    <form
      action={onSubmit}
      className="mt-8 space-y-6 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
    >
      <label className="block">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Frequency</span>
        <select name="frequency" className={inputClass} defaultValue={current.frequency}>
          <option value="MONTHLY">Monthly</option>
          <option value="QUARTERLY">Quarterly</option>
          <option value="CUSTOM">Custom</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Grace Period (days)</span>
        <input
          name="gracePeriodDays"
          type="number"
          min={0}
          className={inputClass}
          defaultValue={current.gracePeriodDays}
        />
      </label>
      <label className="block">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Late Fee Amount (optional, MYR)
        </span>
        <input
          name="lateFeeAmount"
          type="number"
          min={0}
          step="0.01"
          className={inputClass}
          defaultValue={current.lateFeeAmount ?? ''}
          placeholder="e.g. 10.00"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-zinc-900 px-5 py-3 text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save Billing Rule'}
      </button>
      {status && (
        <p className={`text-sm ${status.ok ? 'text-green-600' : 'text-red-600'}`}>
          {status.message}
        </p>
      )}
    </form>
  )
}
