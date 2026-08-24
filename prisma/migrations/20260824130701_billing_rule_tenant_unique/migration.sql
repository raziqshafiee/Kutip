-- DeleteDuplicates (defensive guard - idempotent if no duplicates exist)
-- Keeps only the most recent BillingRule per tenantId before adding the UNIQUE constraint.
-- This protects the ADD CONSTRAINT step in case any duplicate tenantId rows exist
-- (e.g., from a failed prior migration or manual intervention).
-- No application code path creates multiple BillingRules per tenant; this is a safety measure.
DELETE FROM "BillingRule" WHERE "id" NOT IN (
  SELECT DISTINCT ON ("tenantId") "id"
  FROM "BillingRule"
  ORDER BY "tenantId", "createdAt" DESC
);

-- AddUniqueConstraint
ALTER TABLE "BillingRule" ADD CONSTRAINT "BillingRule_tenantId_key" UNIQUE ("tenantId");

-- DropIndex
DROP INDEX IF EXISTS "BillingRule_tenantId_idx";
