import { prisma } from "../../lib/prisma";
import { toSetchProduct, pushProductsToSetch, deleteProductFromSetch } from "../../lib/setch";

export type TreatmentKitInput = {
  slug: string;
  name: string;
  durationMonths: number;
  price: number;
  benefits: string[];
  isActive?: boolean;
  sortOrder?: number;
};

export function listTreatmentKits() {
  return prisma.treatmentKit.findMany({ orderBy: { sortOrder: "asc" } });
}

export function listActiveTreatmentKits() {
  return prisma.treatmentKit.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
}

export function getKitBySlug(slug: string) {
  return prisma.treatmentKit.findUnique({ where: { slug } });
}

export function listKitEnrollments() {
  return prisma.kitEnrollment.findMany({
    include: { kit: true, user: { select: { email: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// Same pattern as Combo's syncComboProduct — every kit upserts a matching
// Product row (isKit: true, same slug) so it flows through cart/checkout
// completely unmodified; payments.service.ts uses isKit + this slug to
// create the KitEnrollment once the order is paid.
async function syncKitProduct(kit: {
  slug: string;
  name: string;
  durationMonths: number;
  price: number;
  benefits: string[];
  isActive: boolean;
}) {
  const data = {
    name: kit.name,
    category: "Treatment Kit",
    price: kit.price,
    originalPrice: kit.price,
    image: "/images/product-placeholder.svg",
    tagline: `${kit.durationMonths}-Month Program`,
    description: `A ${kit.durationMonths}-month personalised skincare programme.`,
    benefits: kit.benefits,
    isActive: kit.isActive,
    inStock: true,
  };

  const synced = await prisma.product.upsert({
    where: { slug: kit.slug },
    create: { slug: kit.slug, isKit: true, ...data },
    update: data,
  });

  if (synced.isActive) {
    await pushProductsToSetch([toSetchProduct(synced)]).catch((err) =>
      console.error("[setch] Failed to push kit product:", err),
    );
  } else {
    await deleteProductFromSetch(synced.slug).catch((err) =>
      console.error("[setch] Failed to remove deactivated kit product:", err),
    );
  }
}

export async function createTreatmentKit(input: TreatmentKitInput) {
  const kit = await prisma.treatmentKit.create({
    data: {
      slug: input.slug,
      name: input.name,
      durationMonths: input.durationMonths,
      price: input.price,
      benefits: input.benefits,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  await syncKitProduct(kit);
  return kit;
}

export async function updateTreatmentKit(slug: string, input: Partial<TreatmentKitInput>) {
  const kit = await prisma.treatmentKit.update({
    where: { slug },
    data: {
      name: input.name,
      durationMonths: input.durationMonths,
      price: input.price,
      benefits: input.benefits,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });
  await syncKitProduct(kit);
  return kit;
}

// Called once an order is confirmed PAID (see payments.service.ts) for
// every kit-flagged line item on it — mirrors
// createProductSubscriptionsForOrder's shape/placement for "Subscription A".
// KitEnrollment.endDate is fixed at creation time from the kit's
// durationMonths as it stood at purchase, so a later admin price/duration
// edit never retroactively shortens or extends an enrollment already sold.
export async function createKitEnrollmentsForOrder(
  userId: string,
  orderId: string,
  kitProductSlugs: string[],
): Promise<{ kitSlug: string; endDate: Date }[]> {
  const uniqueSlugs = [...new Set(kitProductSlugs)];
  if (uniqueSlugs.length === 0) return [];

  const kits = await prisma.treatmentKit.findMany({ where: { slug: { in: uniqueSlugs } } });
  const created: { kitSlug: string; endDate: Date }[] = [];

  for (const kit of kits) {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + kit.durationMonths);

    await prisma.kitEnrollment.create({
      data: { userId, kitId: kit.id, orderId, startDate, endDate },
    });
    created.push({ kitSlug: kit.slug, endDate });
  }

  return created;
}

// Run from the daily cron, same pattern as sales.service.ts's
// deactivateExpiredSales — flips any enrollment whose endDate has passed
// from ACTIVE to EXPIRED so admin/account views reflect it without a
// scheduled job tied to each individual enrollment's own end date.
export async function expireKitEnrollments() {
  await prisma.kitEnrollment.updateMany({
    where: { status: "ACTIVE", endDate: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
}

export async function deleteTreatmentKit(slug: string) {
  await prisma.treatmentKit.delete({ where: { slug } });
  // Same reasoning as deleteCombo — a deleted kit shouldn't remain
  // purchasable via a stale direct product link.
  await prisma.product.deleteMany({ where: { slug, isKit: true } });
  await deleteProductFromSetch(slug).catch((err) =>
    console.error("[setch] Failed to remove deleted kit product:", err),
  );
}
