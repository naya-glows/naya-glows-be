// Ports the same 16 default products from the frontend's lib/products.ts so
// the DB can price/sell them once seeded. Keep these two lists in sync when
// the storefront defaults change — see the Phase 2 plan for why this exists
// (order pricing is always computed server-side from the DB, never trusted
// from the client, so a product must exist here to be purchasable).
//
// price/originalPrice/variants[].price are stored in Naira — the admin's
// real price list and what Paystack actually charges (orders.service.ts
// uses these figures directly, no currency conversion). USD is a
// display-only conversion applied client-side for non-Nigeria visitors.
//
// Lives under src/ (not prisma/) because it's imported at runtime by
// src/lib/runSeed.ts, which the compiled server calls on every boot — a
// file outside tsconfig's rootDir ("src") can't be part of that build.
// prisma/defaultProducts.ts re-exports this so the existing one-off
// migration scripts (backend/scripts/*.ts) keep working unchanged.
export const defaultProducts = [
  {
    slug: "radiance-boost-serum",
    name: "Radiance Boost Serum (Vitamin C)",
    category: "Face Serums",
    categoryAccent: "Boost & Correct",
    price: 15000,
    originalPrice: 15000,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1784381853/naya-glows/legacy/img_6205.jpg",
    tagline: "Brighten & hydrate with Niacinamide",
    description:
      "A lightweight daily serum that brightens skin tone, evens complexion, and delivers deep, lasting hydration. Formulated with Niacinamide, Green Tea, and Hyaluronic Acid for visibly clearer, more radiant skin.",
    benefits: [
      "Brightens & evens skin tone",
      "Deep, lasting hydration",
      "Reduces the look of dark spots",
    ],
  },
  {
    slug: "acne-correcting-serum",
    name: "Glow Renewal Serum (Acne Treatment)",
    category: "Face Serums",
    categoryAccent: "Boost & Correct",
    price: 15000,
    originalPrice: 15000,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1784381830/naya-glows/legacy/0323d23a-ed8d-4ab5-8f52-b8a8eb31e04f.png",
    tagline: "Renew with Azelaic Acid",
    description:
      "A targeted renewal treatment powered by Azelaic Acid and Licorice Root that fades post-acne marks and refines skin texture, helping skin look calmer and more even over time.",
    benefits: [
      "Fades acne marks & hyperpigmentation",
      "Refines texture",
      "Non-drying, daily-use formula",
    ],
  },
  {
    slug: "age-renewal-serum",
    name: "Radiance Correcting Serum (Spot Remover)",
    category: "Face Serums",
    categoryAccent: "Boost & Correct",
    price: 15000,
    originalPrice: 15000,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1784381851/naya-glows/legacy/eca30ff9-62ea-4126-8301-03d590c8250d.png",
    tagline: "Correct with Alpha Arbutin & Kojic Acid",
    description:
      "A correcting serum with Alpha Arbutin, Kojic Acid, and Licorice Extract to support smoother, firmer-looking skin and a more even tone as part of a nightly routine.",
    benefits: [
      "Supports skin renewal",
      "Evens tone & texture",
      "Gentle enough for nightly use",
    ],
  },
  {
    slug: "radiance-renewal-face-cream",
    name: "Radiant Renewal Face Cream",
    category: "Face Creams",
    categoryAccent: "Renew & Correct",
    price: 10000,
    originalPrice: 10000,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1784381847/naya-glows/legacy/b49340ae-6fe1-47f6-be61-8eac75c0ccbf.png",
    tagline: "Deep hydration & renewal",
    description:
      "A rich daily face cream that locks in moisture and supports overnight skin renewal, leaving skin soft, plump, and glowing by morning.",
    benefits: ["Deep hydration", "Supports overnight renewal", "Soft, glowing finish"],
    variants: [
      { name: "Small", price: 10000 },
      { name: "Big", price: 15000 },
    ],
  },
  {
    slug: "pigment-corrector-face-cream",
    name: "Pigment Corrector Face Cream",
    category: "Face Creams",
    categoryAccent: "Renew & Correct",
    price: 10000,
    originalPrice: 10000,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1784381838/naya-glows/legacy/42cbfe95-d2a7-4d13-8a5e-72e62dcf1792.png",
    tagline: "Target hyperpigmentation",
    description:
      "A targeted cream formulated to visibly reduce the appearance of hyperpigmentation and dark spots, for a brighter, more balanced complexion.",
    benefits: [
      "Targets dark spots & hyperpigmentation",
      "Brightens complexion",
      "Balances uneven tone",
    ],
    variants: [
      { name: "Small", price: 10000 },
      { name: "Big", price: 15000 },
    ],
  },
  {
    slug: "radiance-barrier-face-oil",
    name: "Naya Barrier Face Oil",
    category: "Face Creams",
    categoryAccent: "Renew & Correct",
    price: 6500,
    originalPrice: 6500,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1784381833/naya-glows/legacy/08d216cc-1441-4068-996e-ed7d64a65701.png",
    tagline: "Squalane, Argan & Chia blend",
    description:
      "A nourishing face oil blend of Squalane, Argan Oil, and Chia that strengthens the skin barrier and locks in hydration for a healthy, dewy glow.",
    benefits: ["Strengthens skin barrier", "Locks in moisture", "Dewy, healthy glow"],
  },
  {
    slug: "clarifying-foam-cleanser",
    name: "Clarifying Foaming Cleanser",
    category: "Cleanse & Tone",
    categoryAccent: "Purify & Balance",
    price: 10000,
    originalPrice: 10000,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1784381840/naya-glows/legacy/432e42ab-30fd-4531-815a-e4ece090058b.png",
    tagline: "Salicylic Acid pore cleanser",
    description:
      "A gentle daily foaming cleanser with Salicylic Acid, Lactic Acid, and Licorice Root Extract that clears pores of excess oil and impurities without stripping the skin.",
    benefits: ["Clears pores", "Removes excess oil", "Gentle, non-stripping"],
  },
  {
    slug: "clarifying-black-soap",
    name: "Radiant Clarifying Black Soap",
    category: "Body Care",
    categoryAccent: "Glow & Nourish",
    price: 15000,
    originalPrice: 15000,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1784381842/naya-glows/legacy/5d4e84fb-2a40-4b0c-ae19-62d695738a31.png",
    tagline: "Naya Purifying Herbal Complex",
    description:
      "A traditional black soap deep-cleanse bar with our Purifying Herbal Complex that purifies skin and helps calm irritation, leaving skin feeling clean and balanced.",
    benefits: ["Deep cleanses", "Calms irritation", "Traditional, gentle formula"],
  },
  {
    slug: "radiance-balance-toner",
    name: "Radiant Balance Toner",
    category: "Cleanse & Tone",
    categoryAccent: "Purify & Balance",
    price: 8500,
    originalPrice: 8500,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1784381832/naya-glows/legacy/056bf54d-5022-45a9-861d-fa2a3620f4a3.png",
    tagline: "Balance & refine pores",
    description:
      "A refreshing toner with our Skin Clarifying Complex that restores optimal skin pH, refines the look of pores, and preps skin to better absorb the treatments that follow.",
    benefits: ["Balances skin pH", "Refines pores", "Boosts serum absorption"],
  },
  {
    slug: "exfoliating-body-scrub",
    name: "Radiant Exfoliating Body Scrub",
    category: "Body Care",
    categoryAccent: "Glow & Nourish",
    price: 15000,
    originalPrice: 15000,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1784381835/naya-glows/legacy/19ea7a51-adb2-4a49-bcb7-0bbc0116f4f2.png",
    tagline: "Kojic Acid & Lemon brightening",
    description:
      "A brightening body scrub with Kojic Acid, Lemon Extract, and Vitamin E that gently exfoliates dead skin, smooths rough texture, and reveals a more even tone.",
    benefits: ["Brightens & evens tone", "Smooths rough texture", "Gently exfoliates"],
  },
  {
    slug: "purifying-body-wash",
    name: "Radiant Purifying Body Wash",
    category: "Body Care",
    categoryAccent: "Glow & Nourish",
    price: 15000,
    originalPrice: 15000,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1784381837/naya-glows/legacy/2999b980-d234-482d-9e97-982f1bf1579a.png",
    tagline: "Kojic Acid & Kaolin Clay cleanser",
    description:
      "A daily body wash with Kojic Acid, Licorice Root Extract, and Kaolin Clay that gently draws out impurities while keeping skin soft, clean, and balanced.",
    benefits: ["Draws out impurities", "Keeps skin soft", "Daily-use formula"],
  },
  {
    slug: "radiance-repair-body-lotion",
    name: "Radiant Repair Body Lotion",
    category: "Body Care",
    categoryAccent: "Glow & Nourish",
    price: 20500,
    originalPrice: 20500,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1784381841/naya-glows/legacy/5bbe98ac-b9a9-40aa-95a1-ad2f9d7a2ce6.png",
    tagline: "Tranexamic Acid & Vitamin C",
    description:
      "A repairing daily body lotion with Tranexamic Acid, Alpha-Arbutin, Vitamin C, and Niacinamide that helps even skin tone and restore radiance from neck to toe.",
    benefits: ["Evens skin tone", "Restores radiance", "Lightweight daily wear"],
  },
  {
    slug: "luminous-glow-body-oil",
    name: "Luminous Glow Oil",
    category: "Body Care",
    categoryAccent: "Glow & Nourish",
    price: 15000,
    originalPrice: 15000,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1784381845/naya-glows/legacy/9cb3aae2-d6b9-4d9d-8a24-e679c00c2705.png",
    tagline: "Argan, Sweet Almond & Licorice",
    description:
      "A fast-absorbing dry body oil blended with Argan Oil, Sweet Almond Oil, and Licorice for a luminous, non-greasy glow from head to toe.",
    benefits: ["Luminous, non-greasy glow", "Fast-absorbing", "Nourishes dry skin"],
  },
  {
    slug: "radiance-nourishing-body-butter",
    name: "Body Butter",
    category: "Body Care",
    categoryAccent: "Glow & Nourish",
    price: 15000,
    originalPrice: 15000,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1785160442/naya-glows/recent/radiance-nourishing-body-butter.png",
    tagline: "Rich, whipped daily nourishment",
    description:
      "A rich, whipped body butter that melts into skin for deep, lasting nourishment — leaving skin soft, supple, and glowing from head to toe.",
    benefits: ["Deep, lasting nourishment", "Soft, supple skin", "Rich, whipped texture"],
  },
  {
    slug: "soothing-face-cream-wash",
    name: "Soothing Face Cream Wash",
    category: "Cleanse & Tone",
    categoryAccent: "Purify & Balance",
    price: 7000,
    originalPrice: 7000,
    image: "/images/product-placeholder.svg",
    tagline: "Gentle daily cream cleanser",
    description:
      "A gentle, creamy daily cleanser that lifts away dirt and makeup while soothing and calming the skin, leaving it clean without feeling stripped.",
    benefits: ["Soothes & calms skin", "Gentle daily cleanse", "Non-stripping formula"],
  },
  {
    slug: "aloe-vera-gel",
    name: "Aloe Vera Gel",
    category: "Face Creams",
    categoryAccent: "Renew & Correct",
    price: 5000,
    originalPrice: 5000,
    image: "/images/product-placeholder.svg",
    tagline: "Pure, cooling hydration",
    description:
      "A pure, cooling aloe vera gel that soothes and hydrates skin, ideal for calming irritation and locking in moisture after sun or daily wear.",
    benefits: ["Cools & soothes skin", "Lightweight hydration", "Multi-use, all over the body"],
  },
  {
    slug: "naya-luxe-evocative-scent",
    name: "Naya Luxe — Evocative Scent",
    category: "Scent",
    categoryAccent: "Signature Fragrance",
    price: 25600,
    originalPrice: 25600,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1785179623/naya-glows/recent/naya-evocative-scent.png",
    tagline: "A signature, layered evocative blend",
    description:
      "A signature Naya Luxe fragrance — layered and complex, designed to linger. 50ml.",
    benefits: ["Long-lasting wear", "Signature Naya Luxe scent", "50ml glass bottle"],
  },
  {
    slug: "naya-luxe-amber-bloom",
    name: "Naya Luxe — Amber Bloom",
    category: "Scent",
    categoryAccent: "Signature Fragrance",
    price: 25600,
    originalPrice: 25600,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1785179623/naya-glows/recent/naya-evocative-scent.png",
    tagline: "Warm amber wrapped in soft florals",
    description:
      "A Naya Luxe fragrance built on warm amber wrapped in soft floral petals, for a rich and inviting finish. 50ml.",
    benefits: ["Long-lasting wear", "Signature Naya Luxe scent", "50ml glass bottle"],
  },
  {
    slug: "naya-luxe-citrus-noir",
    name: "Naya Luxe — Citrus Noir",
    category: "Scent",
    categoryAccent: "Signature Fragrance",
    price: 25600,
    originalPrice: 25600,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1785179623/naya-glows/recent/naya-evocative-scent.png",
    tagline: "Bright citrus over a mysterious base",
    description:
      "A Naya Luxe fragrance pairing bright citrus top notes with a deep, mysterious base for day-to-night wear. 50ml.",
    benefits: ["Long-lasting wear", "Signature Naya Luxe scent", "50ml glass bottle"],
  },
  {
    slug: "naya-luxe-velvet-oud",
    name: "Naya Luxe — Velvet Oud",
    category: "Scent",
    categoryAccent: "Signature Fragrance",
    price: 25600,
    originalPrice: 25600,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1785179623/naya-glows/recent/naya-evocative-scent.png",
    tagline: "Rich oud, smoothed by velvety warmth",
    description:
      "A Naya Luxe fragrance centered on rich oud, softened by velvety warmth for a bold, grounded finish. 50ml.",
    benefits: ["Long-lasting wear", "Signature Naya Luxe scent", "50ml glass bottle"],
  },
  {
    slug: "naya-luxe-white-musk",
    name: "Naya Luxe — White Musk",
    category: "Scent",
    categoryAccent: "Signature Fragrance",
    price: 25600,
    originalPrice: 25600,
    image: "https://res.cloudinary.com/bhozkz7o/image/upload/v1785179623/naya-glows/recent/naya-evocative-scent.png",
    tagline: "Clean, radiant musk with a soft finish",
    description:
      "A Naya Luxe fragrance built on clean, radiant musk with a soft, skin-like finish that wears close and light. 50ml.",
    benefits: ["Long-lasting wear", "Signature Naya Luxe scent", "50ml glass bottle"],
  },
];
