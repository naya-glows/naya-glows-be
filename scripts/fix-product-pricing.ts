import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { defaultProducts } from "../prisma/defaultProducts";

// One-off sync of the admin's real NGN price list (screenshot) into the DB,
// converted to USD at the current ₦1600/$1 rate, plus the 3 name/category
// corrections that came with it and the new Small/Big variants on the two
// face creams. Deliberately scoped to these fields only — image/tagline/
// description were already fixed in fix-product-mapping.ts.
async function main() {
  let updated = 0;
  for (const product of defaultProducts) {
    const result = await prisma.product.updateMany({
      where: { slug: product.slug },
      data: {
        name: product.name,
        category: product.category,
        price: product.price,
        originalPrice: product.originalPrice,
        variants: "variants" in product ? product.variants : undefined,
      },
    });
    if (result.count > 0) {
      updated += result.count;
      console.log(`Updated ${product.slug} -> ${product.name} ($${product.price})`);
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
