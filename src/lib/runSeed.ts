import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { defaultProducts } from "../data/defaultProducts";
import { createTreatmentKit } from "../modules/kits/kits.service";

// Real, client-supplied Black Friday reservation kits (not placeholders) —
// "Black Friday Early Reservation Feature" brief. A ₦5,000 deposit now,
// balance due on Black Friday itself (see reservations.service.ts's
// BLACK_FRIDAY_BALANCE_DUE_DATE).
// Real, client-supplied consultation services — "Standard Consultation:
// ₦10,000 – 30 minutes" and "Extended Consultation: ₦20,000 – Extended
// session" (no exact duration given for Extended; 60 minutes is a
// reasonable default, admin-editable via /admin/consultations).
const defaultConsultationTypes = [
  { slug: "standard", name: "Standard Consultation", feeNgn: 10000, durationMinutes: 30, sortOrder: 0 },
  { slug: "extended", name: "Extended Consultation", feeNgn: 20000, durationMinutes: 60, sortOrder: 1 },
];

const defaultReservationKits = [
  { slug: "spot-fade-kit", name: "Spot Fade Kit", totalPrice: 29500, depositAmount: 5000, publicPrice: null, sortOrder: 0 },
  { slug: "acne-clear-fade-kit", name: "Acne Clear + Fade Kit", totalPrice: 31000, depositAmount: 5000, publicPrice: null, sortOrder: 1 },
  { slug: "body-glow-set", name: "Body Glow Set (Full Kit)", totalPrice: 60000, depositAmount: 5000, publicPrice: 63000, sortOrder: 2 },
];

// Real, client-supplied Treatment Kit tiers — Bronze/Silver/Gold pricing and
// duration are the brief's own proposed figures (never revised by
// updated-directives.txt), kept as plain "Complete skincare kit for N
// months" copy since no richer per-tier breakdown was ever supplied.
// Premium's benefits are updated-directives.txt's final, real copy
// ("Premium Package – ₦2,000,000"), superseding the original brief's
// looser "3 months past subscription" draft wording.
const defaultTreatmentKits = [
  {
    slug: "bronze-kit",
    name: "Bronze",
    durationMonths: 2,
    price: 250000,
    benefits: ["Complete skincare kit for two months"],
    sortOrder: 0,
  },
  {
    slug: "silver-kit",
    name: "Silver",
    durationMonths: 4,
    price: 550000,
    benefits: ["Complete skincare kit for four months"],
    sortOrder: 1,
  },
  {
    slug: "gold-kit",
    name: "Gold",
    durationMonths: 8,
    price: 1000000,
    benefits: ["Complete skincare kit for eight months"],
    sortOrder: 2,
  },
  {
    slug: "premium-kit",
    name: "Premium",
    durationMonths: 12,
    price: 2000000,
    benefits: [
      "12 Months of Skincare Supply: A full year of personalised skincare products to support your skin goals.",
      "3 Months of Complimentary Spa Experiences: Access to complimentary spa experiences through our partnered spa, within the programme period.",
      "3 Months of Skin Specialist Support: Three months of dedicated access to our skincare specialist for ongoing guidance and support as you work towards your skincare goals.",
    ],
    sortOrder: 3,
  },
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

async function seedConsultationTypes() {
  let created = 0;
  for (const type of defaultConsultationTypes) {
    await prisma.consultationType.upsert({
      where: { slug: type.slug },
      update: {},
      create: type,
    });
    created += 1;
  }
  console.log(`[seed] Seeded/verified ${created} consultation types.`);
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

async function seedTreatmentKits() {
  let created = 0;
  for (const kit of defaultTreatmentKits) {
    const existing = await prisma.treatmentKit.findUnique({ where: { slug: kit.slug } });
    if (existing) continue;
    // Goes through the service function (not a raw upsert, unlike the other
    // seed helpers above) so the kit's synthetic Product row gets created
    // too — createTreatmentKit is what makes it purchasable via cart/checkout.
    await createTreatmentKit(kit);
    created += 1;
  }
  console.log(`[seed] Seeded ${created} treatment kits.`);
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
  await seedConsultationTypes();
  await seedReservationKits();
  await seedTreatmentKits();
}
