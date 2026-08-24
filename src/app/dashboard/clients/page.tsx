import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getOrCreateTenantForOrg } from '@/lib/tenant'
import { listClientsForTenant } from '@/lib/clients/service'
import { DeleteClientButton } from './delete-client-button'

function formatMYR(amount: number): string {
  return `RM ${amount.toFixed(2)}`
}

export default async function ClientsPage() {
  const { orgId, orgSlug } = await auth()

  if (!orgId) {
    redirect('/sign-in')
  }

  const business = await getOrCreateTenantForOrg(orgId, orgSlug ?? 'My Business')
  const clients = await listClientsForTenant(business.id)

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Clients</h1>
        <Link
          href="/dashboard/clients/new"
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm text-white"
        >
          Add client
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Phone</th>
              <th className="py-2 pr-4">Tier</th>
              <th className="py-2 pr-4">Amount</th>
              <th className="py-2 pr-4">Cycle Day</th>
              <th className="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-4">{client.name}</td>
                <td className="py-2 pr-4">{client.phoneE164}</td>
                <td className="py-2 pr-4">{client.serviceTier ?? '—'}</td>
                <td className="py-2 pr-4">{formatMYR(client.billingAmount.toNumber())}</td>
                <td className="py-2 pr-4">{client.billingCycleDay}</td>
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/dashboard/clients/${client.id}/edit`}
                      className="text-zinc-900 underline dark:text-zinc-50"
                    >
                      Edit
                    </Link>
                    <DeleteClientButton clientId={client.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && (
          <p className="mt-6 text-sm text-zinc-500">
            No clients yet. Add your first client to start billing.
          </p>
        )}
      </div>
    </main>
  )
}
