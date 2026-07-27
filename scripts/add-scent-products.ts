import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { defaultProducts } from "../prisma/defaultProducts";

// The 5 Scent variants added this pass — all share the same Naya Luxe
// bottle photo but list as distinct catalog products. Upserts by slug so
// re-running is safe and existing rows are untouched.
const NEW_SLUGS = [
  "naya-luxe-evocative-scent",
  "naya-luxe-amber-bloom",
  "naya-luxe-citrus-noir",
  "naya-luxe-velvet-oud",
  "naya-luxe-white-musk",
];

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
