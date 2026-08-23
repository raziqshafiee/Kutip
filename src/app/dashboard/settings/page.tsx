import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getOrCreateTenantForOrg } from '@/lib/tenant'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const { orgId, orgSlug } = await auth()

  if (!orgId) {
    redirect('/sign-in')
  }

  const business = await getOrCreateTenantForOrg(orgId, orgSlug ?? 'My Business')

  // Never expose secrets to the client. Pass booleans/enums and only whether
  // a secret is already set (for masking/placeholder purposes).
  const current = {
    toyyibpayCategoryCode: business.toyyibpayCategoryCode ?? '',
    toyyibpaySandbox: business.toyyibpaySandbox,
    toyyibpayHasSecret: Boolean(business.toyyibpayUserSecretKey),
    whatsappChannel: business.whatsappChannel,
    cloudApiPhoneNumberId: business.cloudApiPhoneNumberId ?? '',
    cloudApiTemplateName: business.cloudApiTemplateName ?? '',
    cloudApiHasToken: Boolean(business.cloudApiAccessToken),
    qrSessionId: business.qrSessionId ?? '',
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Configure payment and WhatsApp credentials for {business.name}.
      </p>
      <SettingsForm businessId={business.id} current={current} />
    </main>
  )
}