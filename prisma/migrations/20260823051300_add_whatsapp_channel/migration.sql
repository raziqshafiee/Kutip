-- CreateEnum
CREATE TYPE "WhatsAppChannel" AS ENUM ('NONE', 'CLOUD_API', 'QR_SESSION');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "cloudApiAccessToken" TEXT,
ADD COLUMN     "cloudApiPhoneNumberId" TEXT,
ADD COLUMN     "cloudApiTemplateName" TEXT,
ADD COLUMN     "qrSessionId" TEXT,
ADD COLUMN     "whatsappChannel" "WhatsAppChannel" NOT NULL DEFAULT 'NONE';