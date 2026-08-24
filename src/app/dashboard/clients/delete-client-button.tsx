'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteClientAction } from '@/lib/clients/actions'

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDelete() {
    if (!confirm('Delete this client? This cannot be undone.')) {
      return
    }
    setPending(true)
    setError(null)

    const result = await deleteClientAction(clientId)

    if (result.ok) {
      router.refresh()
    } else {
      setError(result.error)
    }
    setPending(false)
  }

  return (
    <div>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="text-red-600 underline disabled:opacity-50"
      >
        {pending ? 'Deleting…' : 'Delete'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
