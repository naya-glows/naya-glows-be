-- CreateEnum
CREATE TYPE "KitReservationStatus" AS ENUM ('RESERVED', 'BALANCE_PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "TreatmentKit" DROP COLUMN "consultationEveryMonths",
DROP COLUMN "extraMonths",
DROP COLUMN "specialistAccessMonthly";

-- CreateTable
CREATE TABLE "ReservationKit" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "depositAmount" DOUBLE PRECISION NOT NULL,
    "publicPrice" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitReservation" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "depositAmount" DOUBLE PRECISION NOT NULL,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "depositReference" TEXT,
    "balanceAmount" DOUBLE PRECISION NOT NULL,
    "balanceDueDate" TIMESTAMP(3) NOT NULL,
    "balancePaid" BOOLEAN NOT NULL DEFAULT false,
    "balanceReference" TEXT,
    "status" "KitReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReservationKit_slug_key" ON "ReservationKit"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "KitReservation_depositReference_key" ON "KitReservation"("depositReference");

-- CreateIndex
CREATE UNIQUE INDEX "KitReservation_balanceReference_key" ON "KitReservation"("balanceReference");

-- AddForeignKey
ALTER TABLE "KitReservation" ADD CONSTRAINT "KitReservation_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "ReservationKit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

