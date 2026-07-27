import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { defaultProducts } from "../prisma/defaultProducts";

// The 3 products identified in the screenshot catalog that had no matching
// local photo. Upserts by slug so re-running is safe and existing rows are
// untouched (update: {} — same pattern as prisma/seed.ts#seedProducts).
const NEW_SLUGS = ["radiance-nourishing-body-butter", "soothing-face-cream-wash", "aloe-vera-gel"];

async function main() {
  let created = 0;
  for (const product of defaultProducts) {
    if (!NEW_SLUGS.includes(product.slug)) continue;
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: product,
    });
    created += 1;
    console.log(`Upserted ${product.slug}`);
  }
  console.log(`\nDone. Upserted ${created} product row(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
