'use client'

import { useState } from 'react'
import { updateBusinessSettings } from '@/lib/settings/updateBusiness'
import type { SettingsInput } from '@/lib/settings/updateBusiness'

type Current = {
  toyyibpayCategoryCode: string
  toyyibpaySandbox: boolean
  toyyibpayHasSecret: boolean
  whatsappChannel: 'NONE' | 'CLOUD_API' | 'QR_SESSION'
  cloudApiPhoneNumberId: string
  cloudApiTemplateName: string
  cloudApiHasToken: boolean
  qrSessionId: string
}

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'

export function SettingsForm({
  current,
}: {
  businessId: string
  current: Current
}) {
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(formData: FormData) {
    setPending(true)
    setStatus(null)

    const toyyibpaySandbox = formData.get('toyyibpaySandbox') === 'on'

    const input: SettingsInput = {
      toyyibpayUserSecretKey: String(formData.get('toyyibpayUserSecretKey') ?? ''),
      toyyibpayCategoryCode: String(formData.get('toyyibpayCategoryCode') ?? ''),
      toyyibpaySandbox,
      whatsappChannel: String(formData.get('whatsappChannel') ?? 'NONE') as SettingsInput['whatsappChannel'],
      cloudApiPhoneNumberId: String(formData.get('cloudApiPhoneNumberId') ?? ''),
      cloudApiAccessToken: String(formData.get('cloudApiAccessToken') ?? ''),
      cloudApiTemplateName: String(formData.get('cloudApiTemplateName') ?? ''),
      qrSessionId: String(formData.get('qrSessionId') ?? ''),
    }

    const result = await updateBusinessSettings(input)

    if (result.ok) {
      setStatus({ ok: true, message: 'Settings saved.' })
    } else {
      setStatus({ ok: false, message: result.error })
    }
    setPending(false)
  }

  return (
    <form action={onSubmit} className="mt-8 space-y-8">
      {/* Payment */}
      <section className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Payment (ToyyibPay)</h2>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">User Secret Key</span>
            <input
              name="toyyibpayUserSecretKey"
              type="password"
              className={inputClass}
              placeholder={current.toyyibpayHasSecret ? '•••••••• (already set — leave blank to keep)' : 'Your ToyyibPay User Secret Key'}
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Category Code</span>
            <input
              name="toyyibpayCategoryCode"
              className={inputClass}
              defaultValue={current.toyyibpayCategoryCode}
              placeholder="e.g. abc123"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              name="toyyibpaySandbox"
              type="checkbox"
              defaultChecked={current.toyyibpaySandbox}
              className="h-4 w-4"
            />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Sandbox mode (use during testing)</span>
          </label>
        </div>
      </section>

      {/* WhatsApp */}
      <section className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">WhatsApp Channel</h2>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Channel</span>
            <select name="whatsappChannel" className={inputClass} defaultValue={current.whatsappChannel}>
              <option value="NONE">None (not connected)</option>
              <option value="CLOUD_API">Meta WhatsApp Cloud API</option>
              <option value="QR_SESSION">QR Session (opt-in, ToS risk)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Phone Number ID</span>
            <input
              name="cloudApiPhoneNumberId"
              className={inputClass}
              defaultValue={current.cloudApiPhoneNumberId}
              placeholder="e.g. 1234567890"
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Access Token</span>
            <input
              name="cloudApiAccessToken"
              type="password"
              className={inputClass}
              placeholder={current.cloudApiHasToken ? '•••••••• (already set — leave blank to keep)' : 'WhatsApp access token'}
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Template Name (optional)</span>
            <input
              name="cloudApiTemplateName"
              className={inputClass}
              defaultValue={current.cloudApiTemplateName}
              placeholder="e.g. invoice_reminder"
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">QR Session ID (QR channel only)</span>
            <input
              name="qrSessionId"
              className={inputClass}
              defaultValue={current.qrSessionId}
              placeholder="e.g. session-1"
            />
          </label>
          {current.whatsappChannel === 'QR_SESSION' && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ The QR session uses the unofficial WhatsApp Web protocol and may get
              your number banned. Use only if you understand the risk.
            </p>
          )}
        </div>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-zinc-900 px-5 py-3 text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save Settings'}
      </button>

      {status && (
        <p className={`text-sm ${status.ok ? 'text-green-600' : 'text-red-600'}`}>
          {status.message}
        </p>
      )}
    </form>
  )
}