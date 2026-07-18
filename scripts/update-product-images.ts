import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { defaultProducts } from "../prisma/defaultProducts";

// The DB was seeded from defaultProducts.ts before its image fields were
// migrated to Cloudinary. This only touches the `image` column, matched by
// slug, so any other admin edits to price/name/etc. on these rows survive.
async function main() {
  let updated = 0;
  for (const product of defaultProducts) {
    const result = await prisma.product.updateMany({
      where: { slug: product.slug },
      data: { image: product.image },
    });
    if (result.count > 0) {
      updated += result.count;
      console.log(`Updated ${product.slug} -> ${product.image}`);
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
