import { prisma } from "../../lib/prisma";
import { getSubscriptionDiscountPercent } from "../settings/settings.service";

function generateCandidateCode(): string {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X");
  return `SAVE${suffix}`;
}

// "Subscription A" — called once an order is confirmed PAID (see
// payments.service.ts) for every line item the customer opted into
// subscribing to. The qualifying order always ships at full price; this is
// what unlocks the standing discount for every purchase *after* it (see
// orders.service.ts, which auto-applies the discount once this row exists).
// A customer who already has a subscription for a product is a no-op here —
// buying it again doesn't reset or duplicate anything.
export async function createProductSubscriptionsForOrder(
  userId: string,
  orderId: string,
  productIds: string[],
): Promise<{ productId: string; code: string }[]> {
  const uniqueProductIds = [...new Set(productIds)];
  if (uniqueProductIds.length === 0) return [];

  const discountPercent = await getSubscriptionDiscountPercent();
  const created: { productId: string; code: string }[] = [];

  for (const productId of uniqueProductIds) {
    const existing = await prisma.productSubscription.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) continue;

    // Collisions are astronomically unlikely (4 letters + 6 base36 chars)
    // but retry a few times rather than trusting that entirely.
    let code: string | null = null;
    for (let attempt = 0; attempt < 5 && !code; attempt++) {
      const candidate = generateCandidateCode();
      const clash = await prisma.productSubscription.findUnique({ where: { code: candidate } });
      if (!clash) code = candidate;
    }
    if (!code) continue; // skip rather than fail the whole order over this

    await prisma.productSubscription.create({
      data: { userId, productId, code, discountPercent, firstOrderId: orderId },
    });
    created.push({ productId, code });
  }

  return created;
}

export async function listMyProductSubscriptions(userId: string) {
  return prisma.productSubscription.findMany({
    where: { userId },
    include: { product: { select: { slug: true, name: true, image: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// Keyed by productId — used by orders.service.ts to auto-apply each
// subscribed product's standing discount without the customer needing to
// enter anything. The literal `code` is still generated and emailed (see
// createProductSubscriptionsForOrder) so it exists as a human-readable
// reference — useful for the admin to quote back on an off-platform (e.g.
// Instagram DM) order — but the website itself never requires typing it in.
export async function getMyActiveProductSubscriptionsByProductId(userId: string) {
  const subscriptions = await prisma.productSubscription.findMany({ where: { userId } });
  return new Map(subscriptions.map((s) => [s.productId, s]));
}
