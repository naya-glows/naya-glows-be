import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/appError";
import { getTrackingStageLabel } from "./tracking";
import { sendMail } from "../../lib/mailer";
import { orderStatusUpdateEmail } from "../../lib/emailTemplates";
import { getMyActiveProductSubscriptionsByProductId } from "../subscriptions/productSubscriptions.service";

// Naira is the canonical unit Product.price/originalPrice/variants[].price
// are stored in — Paystack charges NGN and the admin's real price list is
// NGN, so there's no USD->NGN conversion step here anymore; USD is a
// display-only conversion applied client-side (useCurrencyDisplay.ts) for
// non-Nigeria visitors, computed from the same amounts.
const FREE_SHIPPING_THRESHOLD_NGN = 120_000;
const FLAT_SHIPPING_NGN = 9_600;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type OrderItemInput = {
  slug: string;
  qty: number;
  isSubscription?: boolean;
  variantName?: string;
};

export type ShippingDetails = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
};

export async function createOrder(input: {
  items: OrderItemInput[];
  shippingDetails: ShippingDetails;
  userId: string;
}) {
  const slugs = input.items.map((i) => i.slug);
  const [products, standingSubscriptionsByProductId] = await Promise.all([
    prisma.product.findMany({ where: { slug: { in: slugs } } }),
    getMyActiveProductSubscriptionsByProductId(input.userId),
  ]);
  const productBySlug = new Map(products.map((p) => [p.slug, p]));

  const missing = slugs.filter((s) => !productBySlug.has(s));
  if (missing.length > 0) {
    throw new AppError(
      `These items aren't available right now: ${missing.join(", ")}. Please update your cart.`,
    );
  }

  let subtotal = 0;
  const lineItems = input.items.map((item) => {
    const product = productBySlug.get(item.slug)!;
    const qty = Math.max(1, Math.floor(item.qty));

    // Variant price, like the base price, is always resolved server-side
    // from the product's own `variants` — the client only ever signals
    // *which* variant it wants, never the resulting amount.
    const variants = (product.variants as { name: string; price: number }[] | null) ?? [];
    let basePrice = product.price;
    if (variants.length > 0) {
      const variant = variants.find((v) => v.name === item.variantName);
      if (!variant) {
        throw new AppError(
          `Please select a valid size for "${product.name}".`,
        );
      }
      basePrice = variant.price;
    }

    // "Subscription A" — a standing, reusable discount on THIS specific
    // product, unlocked once the customer already has a ProductSubscription
    // row for it (created after their qualifying first, full-price
    // purchase — see payments.service.ts). Auto-applied here, no code entry
    // needed on the site; `item.isSubscription` below is a different thing
    // entirely — it's this order's *intent* to enroll (only meaningful when
    // no standing subscription exists yet, i.e. this IS the qualifying
    // first purchase, which is deliberately never discounted).
    const standing = standingSubscriptionsByProductId.get(product.id);
    const unitPrice = standing ? round2(basePrice * (1 - standing.discountPercent / 100)) : basePrice;
    subtotal += unitPrice * qty;
    return {
      productId: product.id,
      qty,
      price: unitPrice,
      isSubscription: Boolean(item.isSubscription) && !standing,
      variantName: variants.length > 0 ? item.variantName : undefined,
    };
  });

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD_NGN ? 0 : FLAT_SHIPPING_NGN;
  const total = subtotal + shipping;

  const order = await prisma.order.create({
    data: {
      userId: input.userId,
      currency: "NGN",
      subtotal: round2(subtotal),
      shipping: round2(shipping),
      total: round2(total),
      shippingDetails: input.shippingDetails as unknown as Prisma.InputJsonValue,
      items: { create: lineItems },
    },
    include: { items: true },
  });

  return order;
}

export function listOrdersForAdmin() {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      items: { include: { product: { select: { name: true } } } },
      payments: true,
      user: { select: { email: true, name: true } },
    },
  });
}

export function listOrdersForUser(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: { select: { name: true } } } } },
  });
}

export function getOrderById(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: { select: { name: true } } } }, payments: true, user: true },
  });
}

export async function setOrderManualStage(id: string, manualStage: string | null) {
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) return null;

  const order = await prisma.order.update({ where: { id }, data: { manualStage } });

  // Only notify on an actual change to a real stage — not when the admin
  // clears the override back to "Automatic" (nothing new to announce there).
  if (manualStage && manualStage !== existing.manualStage) {
    const shippingDetails = order.shippingDetails as { email?: string } | null;
    const email = shippingDetails?.email;
    const label = getTrackingStageLabel(manualStage);
    if (email && label) {
      // Fire-and-forget — the stage change is already saved above, so the
      // admin's UI shouldn't hang on the customer notification email.
      sendMail({
        to: email,
        subject: `Your Naya Glows order is now: ${label}`,
        html: orderStatusUpdateEmail(order, label),
      }).catch((err) => console.error("[orders] Failed to send tracking update email:", err));
    }
  }

  return order;
}
