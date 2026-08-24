-- DeleteDuplicates - Keep only the most recent BillingRule per tenantId
DELETE FROM "BillingRule" WHERE "id" NOT IN (
  SELECT DISTINCT ON ("tenantId") "id"
  FROM "BillingRule"
  ORDER BY "tenantId", "createdAt" DESC
);

-- AddUniqueConstraint
ALTER TABLE "BillingRule" ADD CONSTRAINT "BillingRule_tenantId_key" UNIQUE ("tenantId");

-- DropIndex
DROP INDEX IF EXISTS "BillingRule_tenantId_idx";
