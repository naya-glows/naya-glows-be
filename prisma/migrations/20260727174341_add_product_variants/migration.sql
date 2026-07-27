-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "variantName" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "variants" JSONB;
