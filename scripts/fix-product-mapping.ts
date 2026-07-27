import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { defaultProducts } from "../prisma/defaultProducts";

// One-off correction for the image/name scramble discovered when matching
// products against their real printed labels (2 serums and 2 oils had been
// cross-assigned to the wrong Cloudinary photo since the original seed).
// Syncs identity fields only (name/category/image/tagline/description/
// benefits) by slug — deliberately leaves price/originalPrice untouched so
// any admin-set pricing survives.
async function main() {
  let updated = 0;
  for (const product of defaultProducts) {
    const result = await prisma.product.updateMany({
      where: { slug: product.slug },
      data: {
        name: product.name,
        category: product.category,
        categoryAccent: product.categoryAccent,
        image: product.image,
        tagline: product.tagline,
        description: product.description,
        benefits: product.benefits,
      },
    });
    if (result.count > 0) {
      updated += result.count;
      console.log(`Updated ${product.slug} -> ${product.name}`);
    }
  }
  console.log(`\nDone. Updated ${updated} product row(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
