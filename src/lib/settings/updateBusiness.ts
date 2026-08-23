'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '../prisma'
import { getOrCreateTenantForOrg } from '../tenant'

export type SettingsInput = {
  toyyibpayUserSecretKey?: string
  toyyibpayCategoryCode?: string
  toyyibpaySandbox?: boolean
  whatsappChannel?: 'NONE' | 'CLOUD_API' | 'QR_SESSION'
  cloudApiPhoneNumberId?: string
  cloudApiAccessToken?: string
  cloudApiTemplateName?: string
  qrSessionId?: string
}

export type SettingsResult = { ok: true } | { ok: false; error: string }

/**
 * Persists business settings for the current tenant. Only non-empty values
 * are written so an empty input never wipes an existing secret.
 */
export async function updateBusinessSettings(
  input: SettingsInput
): Promise<SettingsResult> {
  const { orgId, orgSlug } = await auth()

  if (!orgId) {
    return { ok: false, error: 'Not authenticated' }
  }

  const business = await getOrCreateTenantForOrg(orgId, orgSlug ?? 'My Business')

  const data: Record<string, unknown> = {}

  if (input.toyyibpayUserSecretKey && input.toyyibpayUserSecretKey.trim() !== '') {
    data.toyyibpayUserSecretKey = input.toyyibpayUserSecretKey.trim()
  }
  if (input.toyyibpayCategoryCode && input.toyyibpayCategoryCode.trim() !== '') {
    data.toyyibpayCategoryCode = input.toyyibpayCategoryCode.trim()
  }
  if (typeof input.toyyibpaySandbox === 'boolean') {
    data.toyyibpaySandbox = input.toyyibpaySandbox
  }
  if (input.whatsappChannel) {
    data.whatsappChannel = input.whatsappChannel
  }
  if (input.cloudApiPhoneNumberId && input.cloudApiPhoneNumberId.trim() !== '') {
    data.cloudApiPhoneNumberId = input.cloudApiPhoneNumberId.trim()
  }
  if (input.cloudApiAccessToken && input.cloudApiAccessToken.trim() !== '') {
    data.cloudApiAccessToken = input.cloudApiAccessToken.trim()
  }
  if (input.cloudApiTemplateName && input.cloudApiTemplateName.trim() !== '') {
    data.cloudApiTemplateName = input.cloudApiTemplateName.trim()
  }
  if (input.qrSessionId && input.qrSessionId.trim() !== '') {
    data.qrSessionId = input.qrSessionId.trim()
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: 'No changes provided' }
  }

  await prisma.business.update({
    where: { id: business.id },
    data,
  })

  revalidatePath('/dashboard/settings')
  return { ok: true }
}