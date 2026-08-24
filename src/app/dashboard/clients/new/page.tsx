import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { ClientForm } from '../client-form'

export default async function NewClientPage() {
  const { orgId } = await auth()

  if (!orgId) {
    redirect('/sign-in')
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Add Client</h1>
      <ClientForm mode="create" />
    </main>
  )
}
