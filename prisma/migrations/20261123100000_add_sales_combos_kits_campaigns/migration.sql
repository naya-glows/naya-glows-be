-- CreateEnum
CREATE TYPE "KitEnrollmentStatus" AS ENUM ('ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BusinessInquiryType" AS ENUM ('WHOLESALE', 'CORPORATE_GIFTING', 'WHITE_LABEL');

-- AlterTable
ALTER TABLE "ConsultationRequest" ADD COLUMN     "feeNgn" INTEGER NOT NULL DEFAULT 10000,
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentReference" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "comboProductSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isCombo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WholesaleInquiry" ADD COLUMN     "budget" TEXT,
ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "estimatedQuantity" TEXT,
ADD COLUMN     "type" "BusinessInquiryType" NOT NULL DEFAULT 'WHOLESALE';

-- CreateTable
CREATE TABLE "Combo" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coverImage" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "productSlugs" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Combo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonalSale" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discountPercent" DOUBLE PRECISION NOT NULL,
    "productSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "bannerHeadline" TEXT NOT NULL,
    "bannerCopy" TEXT NOT NULL,
    "bannerImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonalSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "popupHeadline" TEXT NOT NULL,
    "popupCopy" TEXT NOT NULL,
    "popupImage" TEXT,
    "ctaText" TEXT NOT NULL,
    "landingPath" TEXT NOT NULL,
    "prizes" JSONB NOT NULL,
    "socialLinks" JSONB NOT NULL,
    "popupFrequencyDays" INTEGER NOT NULL DEFAULT 7,
    "consentText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "email" TEXT,
    "socialHandle" TEXT,
    "prizeWon" TEXT NOT NULL,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentKit" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "benefits" TEXT[],
    "extraMonths" INTEGER NOT NULL DEFAULT 0,
    "consultationEveryMonths" INTEGER,
    "specialistAccessMonthly" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "KitEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Combo_slug_key" ON "Combo"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonalSale_slug_key" ON "SeasonalSale"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TreatmentKit_slug_key" ON "TreatmentKit"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationRequest_paymentReference_key" ON "ConsultationRequest"("paymentReference");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitEnrollment" ADD CONSTRAINT "KitEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitEnrollment" ADD CONSTRAINT "KitEnrollment_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "TreatmentKit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

