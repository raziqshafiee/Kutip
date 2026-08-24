import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { getOrCreateTenantForOrg } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { ClientForm } from '../../client-form'

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { orgId, orgSlug } = await auth()

  if (!orgId) {
    redirect('/sign-in')
  }

  const { clientId } = await params
  const business = await getOrCreateTenantForOrg(orgId, orgSlug ?? 'My Business')
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId: business.id },
  })

  if (!client) {
    notFound()
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Edit Client</h1>
      <ClientForm
        mode="edit"
        clientId={client.id}
        current={{
          name: client.name,
          phoneE164: client.phoneE164,
          serviceTier: client.serviceTier ?? '',
          billingAmount: client.billingAmount.toNumber(),
          billingCycleDay: client.billingCycleDay,
        }}
      />
    </main>
  )
}
