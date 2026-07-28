import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { defaultProducts } from "../data/defaultProducts";

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@nayaglows.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "changeme123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] Admin already exists: ${email}`);
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

  console.log(`[seed] Seeded admin user: ${email}`);
}

async function seedProducts() {
  let created = 0;
  for (const product of defaultProducts) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: product,
    });
    created += 1;
  }
  console.log(`[seed] Seeded/verified ${created} default products.`);
}

// Idempotent (seedAdmin skips if the email already exists, seedProducts
// upserts without overwriting) — safe to call on every server boot, not
// just once manually. Called from src/index.ts on every startup so seeding
// can never again depend on someone remembering to run `npm run seed`
// against production, or on Railway's dashboard Start Command happening to
// invoke it — see prisma/seed.ts for the manual-run CLI entry point, which
// calls this same function.
export async function runSeed() {
  await seedAdmin();
  await seedProducts();
}
