import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { defaultProducts } from "../data/defaultProducts";

// Real, client-supplied Black Friday reservation kits (not placeholders) —
// "Black Friday Early Reservation Feature" brief. A ₦5,000 deposit now,
// balance due on Black Friday itself (see reservations.service.ts's
// BLACK_FRIDAY_BALANCE_DUE_DATE).
const defaultReservationKits = [
  { slug: "spot-fade-kit", name: "Spot Fade Kit", totalPrice: 29500, depositAmount: 5000, publicPrice: null, sortOrder: 0 },
  { slug: "acne-clear-fade-kit", name: "Acne Clear + Fade Kit", totalPrice: 31000, depositAmount: 5000, publicPrice: null, sortOrder: 1 },
  { slug: "body-glow-set", name: "Body Glow Set (Full Kit)", totalPrice: 60000, depositAmount: 5000, publicPrice: 63000, sortOrder: 2 },
];

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  if (!email) {
    throw new Error("SEED_ADMIN_EMAIL must be set.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] Admin already exists: ${email}`);
    return;
  }

  // Only reached when actually creating the FIRST admin account — an
  // already-seeded environment never hits this, so tightening this later
  // can't break a deployment that's already up and running. Previously
  // fell back to the well-known "changeme123" default from before real
  // env vars were configured anywhere; that default is now public (it's
  // been in .env.example and this project's chat history), so silently
  // seeding an admin account with it would be a real vulnerability rather
  // than a helpful fallback.
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("SEED_ADMIN_PASSWORD must be set to create the initial admin account.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: "Naya Glows",
      lastName: "Admin",
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

async function seedReservationKits() {
  let created = 0;
  for (const kit of defaultReservationKits) {
    await prisma.reservationKit.upsert({
      where: { slug: kit.slug },
      update: {},
      create: kit,
    });
    created += 1;
  }
  console.log(`[seed] Seeded/verified ${created} Black Friday reservation kits.`);
}

// Idempotent (seedAdmin skips if the email already exists, seedProducts/
// seedReservationKits upsert without overwriting) — safe to call on every
// server boot, not just once manually. Called from src/index.ts on every
// startup so seeding can never again depend on someone remembering to run
// `npm run seed` against production, or on Railway's dashboard Start Command
// happening to invoke it — see prisma/seed.ts for the manual-run CLI entry
// point, which calls this same function.
export async function runSeed() {
  await seedAdmin();
  await seedProducts();
  await seedReservationKits();
}
