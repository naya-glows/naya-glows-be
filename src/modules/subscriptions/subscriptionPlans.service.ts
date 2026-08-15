import type { Prisma, SubscriptionTerm } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/appError";
import {
  getSubscriptionBDiscountPercent,
  getSubscriptionBFulfillmentMode,
} from "../settings/settings.service";

const TERM_MONTHS: Record<SubscriptionTerm, number> = {
  THREE_MONTH: 3,
  SIX_MONTH: 6,
  TWELVE_MONTH: 12,
};

export const TERM_LABELS: Record<SubscriptionTerm, string> = {
  THREE_MONTH: "3-Month",
  SIX_MONTH: "6-Month",
  TWELVE_MONTH: "12-Month",
};

export type PlanItemInput = { slug: string; qtyPerMonth: number };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// Computes what a plan would cost — the live preview before paying, and
// also the authoritative source of truth at actual purchase time (never
// trust a client-supplied total). Cost is simply (each product's price ×
// how many months × how many/month), summed, then discounted at the
// term's admin-configured rate — "regardless of what they choose... we
// calculate the cost and the discount applied" per the business rule.
export async function quotePlan(term: SubscriptionTerm, items: PlanItemInput[]) {
  if (items.length === 0) throw new AppError("Choose at least one product for your plan.");

  const slugs = items.map((i) => i.slug);
  const products = await prisma.product.findMany({ where: { slug: { in: slugs } } });
  const productBySlug = new Map(products.map((p) => [p.slug, p]));

  const missing = slugs.filter((s) => !productBySlug.has(s));
  if (missing.length > 0) {
    throw new AppError(`These items aren't available right now: ${missing.join(", ")}.`);
  }

  const months = TERM_MONTHS[term];
  const discountPercent = await getSubscriptionBDiscountPercent(term);

  const resolvedItems = items.map((item) => {
    const product = productBySlug.get(item.slug)!;
    const qtyPerMonth = Math.max(1, Math.floor(item.qtyPerMonth));
    return {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      unitPrice: product.price,
      qtyPerMonth,
      totalQtyForTerm: qtyPerMonth * months,
    };
  });

  const baseTotal = resolvedItems.reduce((sum, i) => sum + i.unitPrice * i.totalQtyForTerm, 0);
  const discountedTotal = round2(baseTotal * (1 - discountPercent / 100));

  return { months, discountPercent, baseTotal: round2(baseTotal), discountedTotal, items: resolvedItems };
}

// Creates the Order (the real Paystack charge target — reuses the exact
// same /payments/paystack/initialize + verify flow every other order
// does) and the SubscriptionPlan record together.
//
// `fulfillmentMode` is read from the admin's *current* setting at this
// exact moment and snapshotted onto the plan — a later admin toggle never
// retroactively changes a plan that's already running.
//
// "immediate": the whole term's quantity ships in this one order.
// "recurring": only month one ships now (remaining months are shipped by
// jobs/subscriptionShipments.ts), but the charge still covers the FULL
// term — Order.total is the full discounted amount even though this
// order's own line items only reflect month one. That's a deliberate,
// documented exception to "total = sum of line items" for this one order
// type, not a bug.
export async function createSubscriptionPlanOrder(
  userId: string,
  term: SubscriptionTerm,
  items: PlanItemInput[],
  shippingDetails: Prisma.InputJsonValue,
) {
  const quote = await quotePlan(term, items);
  const fulfillmentMode = await getSubscriptionBFulfillmentMode();
  const discountMultiplier = 1 - quote.discountPercent / 100;

  const lineItems = quote.items.map((item) => ({
    productId: item.productId,
    qty: fulfillmentMode === "immediate" ? item.totalQtyForTerm : item.qtyPerMonth,
    price: round2(item.unitPrice * discountMultiplier),
  }));

  const plan = await prisma.subscriptionPlan.create({
    data: {
      userId,
      term,
      fulfillmentMode,
      items: quote.items.map((i) => ({ slug: i.slug, name: i.name, qtyPerMonth: i.qtyPerMonth })),
      discountPercent: quote.discountPercent,
      totalPaid: quote.discountedTotal,
      remainingShipments: fulfillmentMode === "recurring" ? quote.months - 1 : 0,
      nextShipmentDate: fulfillmentMode === "recurring" ? addMonths(new Date(), 1) : null,
    },
  });

  const order = await prisma.order.create({
    data: {
      userId,
      currency: "NGN",
      subtotal: quote.discountedTotal,
      shipping: 0,
      total: quote.discountedTotal,
      shippingDetails,
      subscriptionPlanId: plan.id,
      items: { create: lineItems },
    },
    include: { items: { include: { product: { select: { name: true } } } } },
  });

  await prisma.subscriptionPlan.update({ where: { id: plan.id }, data: { orderId: order.id } });

  return { order, plan };
}

export function getPlanByOrderId(orderId: string) {
  return prisma.subscriptionPlan.findFirst({ where: { orderId } });
}

export function listMyPlans(userId: string) {
  return prisma.subscriptionPlan.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export function listAllPlansForAdmin() {
  return prisma.subscriptionPlan.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  });
}
