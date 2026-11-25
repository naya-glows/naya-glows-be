-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "prizes",
ADD COLUMN     "codeValidDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "redemptionRules" TEXT,
ADD COLUMN     "rewardValueNgn" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "termsText" TEXT;

-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "prizeWon",
ADD COLUMN     "rewardCode" TEXT NOT NULL,
ADD COLUMN     "rewardExpiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "rewardRedeemed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rewardValueNgn" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_rewardCode_key" ON "Lead"("rewardCode");

