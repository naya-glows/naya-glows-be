-- AlterTable
ALTER TABLE "WholesaleInquiry" ADD COLUMN     "feeNgn" INTEGER,
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleInquiry_paymentReference_key" ON "WholesaleInquiry"("paymentReference");

