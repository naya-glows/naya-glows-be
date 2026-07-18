import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { defaultProducts } from "./defaultProducts";

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@nayaglows.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "changeme123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Naya Glows Admin",
      role: "ADMIN",
      country: "NG",
      currency: "NGN",
    },
  });

  console.log(`Seeded admin user: ${email} / ${password}`);
}

async function seedProducts() {
  let created = 0;
  for (const product of defaultProducts) {
    const result = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: product,
    });
    if (result) created += 1;
  }
  console.log(`Seeded/verified ${created} default products.`);
}

async function main() {
  await seedAdmin();
  await seedProducts();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
