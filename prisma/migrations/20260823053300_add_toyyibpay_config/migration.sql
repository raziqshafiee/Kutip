-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "toyyibpayCategoryCode" TEXT,
ADD COLUMN     "toyyibpaySandbox" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "toyyibpayUserSecretKey" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "billCode" TEXT,
ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "hashValue" TEXT,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING';