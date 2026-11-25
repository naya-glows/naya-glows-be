-- AlterTable
ALTER TABLE "ConsultationRequest" ADD COLUMN     "bookingReference" TEXT,
ADD COLUMN     "consultationTypeId" TEXT,
ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "scheduledDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ConsultationType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feeNgn" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ConsultationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationBlock" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationType_slug_key" ON "ConsultationType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationRequest_bookingReference_key" ON "ConsultationRequest"("bookingReference");

-- AddForeignKey
ALTER TABLE "ConsultationRequest" ADD CONSTRAINT "ConsultationRequest_consultationTypeId_fkey" FOREIGN KEY ("consultationTypeId") REFERENCES "ConsultationType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

