import { prisma } from './prisma'
import type { Business } from '../generated/prisma/client'

export async function getOrCreateTenantForOrg(
  clerkOrgId: string,
  name: string
): Promise<Business> {
  return prisma.business.upsert({
    where: { clerkOrgId },
    update: { name },
    create: { clerkOrgId, name },
  })
}