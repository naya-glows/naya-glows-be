import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { defaultProducts } from "../src/data/defaultProducts";

// One-off corrective fix: directly SETS each seeded product's price to the
// known-correct Naira value from defaultProducts.ts, rather than doing any
// math on whatever's currently stored — unlike the earlier conversion
// script (which multiplied existing values by a rate and was dangerous to
// run twice), this is safe to re-run any number of times, since it always
// lands on the same correct value regardless of what was there before.
// Only touches slugs that exist in defaultProducts.ts — an admin-created
// custom product not in that list is left completely alone.
async function main() {
  let updated = 0;

  for (const product of defaultProducts) {
    const result = await prisma.product.updateMany({
      where: { slug: product.slug },
      data: {
        price: product.price,
        originalPrice: product.originalPrice,
        variants: product.variants ? product.variants : undefined,
      },
    });
    if (result.count > 0) {
      updated += result.count;
      console.log(`${product.slug} -> ₦${product.price.toLocaleString()}`);
    }
  }

  console.log(`\nDone. Fixed ${updated} product row(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
