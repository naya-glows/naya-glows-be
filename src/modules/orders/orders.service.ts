import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/appError";
import { getUsdToNgnRate, getSubscriptionDiscountPercent } from "../settings/settings.service";
import { getTrackingStageLabel } from "./tracking";
import { sendMail } from "../../lib/mailer";
import { orderStatusUpdateEmail } from "../../lib/emailTemplates";

const FREE_SHIPPING_THRESHOLD_USD = 75;
const FLAT_SHIPPING_USD = 6;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type OrderItemInput = { slug: string; qty: number; isSubscription?: boolean };

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
  userId?: string;
}) {
  const slugs = input.items.map((i) => i.slug);
  const [products, rate, discountPercent] = await Promise.all([
    prisma.product.findMany({ where: { slug: { in: slugs } } }),
    getUsdToNgnRate(),
    getSubscriptionDiscountPercent(),
  ]);
  const productBySlug = new Map(products.map((p) => [p.slug, p]));

  const missing = slugs.filter((s) => !productBySlug.has(s));
  if (missing.length > 0) {
    throw new AppError(
      `These items aren't available right now: ${missing.join(", ")}. Please update your cart.`,
    );
  }

  let subtotalUsd = 0;
  const lineItems = input.items.map((item) => {
    const product = productBySlug.get(item.slug)!;
    const qty = Math.max(1, Math.floor(item.qty));
    // Discount, like the base price, is always computed server-side from
    // the product's real price and the admin-configured Setting — the
    // client only signals *intent* to subscribe, never the resulting amount.
    const unitPrice = item.isSubscription
      ? round2(product.price * (1 - discountPercent / 100))
      : product.price;
    subtotalUsd += unitPrice * qty;
    return {
      productId: product.id,
      qty,
      price: unitPrice,
      isSubscription: Boolean(item.isSubscription),
    };
  });

  const shippingUsd = subtotalUsd >= FREE_SHIPPING_THRESHOLD_USD ? 0 : FLAT_SHIPPING_USD;
  const totalUsd = subtotalUsd + shippingUsd;

  const order = await prisma.order.create({
    data: {
      userId: input.userId,
      currency: "NGN",
      subtotal: round2(subtotalUsd * rate),
      shipping: round2(shippingUsd * rate),
      total: round2(totalUsd * rate),
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
      await sendMail({
        to: email,
        subject: `Your Naya Glows order is now: ${label}`,
        html: orderStatusUpdateEmail(order, label),
      });
    }
  }

  return order;
}
