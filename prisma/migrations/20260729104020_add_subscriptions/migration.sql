-- CreateEnum
CREATE TYPE "SubscriptionTerm" AS ENUM ('THREE_MONTH', 'SIX_MONTH', 'TWELVE_MONTH');

-- CreateEnum
CREATE TYPE "SubscriptionPlanStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "ProductSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" DOUBLE PRECISION NOT NULL,
    "firstOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "term" "SubscriptionTerm" NOT NULL,
    "fulfillmentMode" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "discountPercent" DOUBLE PRECISION NOT NULL,
    "totalPaid" DOUBLE PRECISION NOT NULL,
    "status" "SubscriptionPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "orderId" TEXT,
    "remainingShipments" INTEGER NOT NULL DEFAULT 0,
    "nextShipmentDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductSubscription_code_key" ON "ProductSubscription"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSubscription_userId_productId_key" ON "ProductSubscription"("userId", "productId");

-- AddForeignKey
ALTER TABLE "ProductSubscription" ADD CONSTRAINT "ProductSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSubscription" ADD CONSTRAINT "ProductSubscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
