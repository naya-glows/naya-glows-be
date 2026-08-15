import { prisma } from "../../lib/prisma";

export type CartItemSnapshot = {
  slug: string;
  name: string;
  qty: number;
};

// Upserts the signed-in user's cart snapshot. Resetting reminderSentAt here
// (not just on creation) means any edit to the cart — adding, removing, or
// changing quantity — starts a fresh 14-day abandonment clock rather than
// permanently exhausting the one reminder this user will ever get.
export async function syncCart(userId: string, items: CartItemSnapshot[]) {
  await prisma.cart.upsert({
    where: { userId },
    create: { userId, items },
    update: { items, reminderSentAt: null },
  });
}

const ABANDONED_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

export async function findAbandonedCarts() {
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS);
  const carts = await prisma.cart.findMany({
    where: { updatedAt: { lte: cutoff }, reminderSentAt: null },
    include: { user: { select: { id: true, email: true, firstName: true } } },
  });
  // Json[] can't be filtered in the where clause portably — cheap enough to
  // filter empty carts in memory given this only ever runs once a day.
  return carts.filter((cart) => Array.isArray(cart.items) && cart.items.length > 0);
}

export async function markReminderSent(cartId: string) {
  await prisma.cart.update({ where: { id: cartId }, data: { reminderSentAt: new Date() } });
}
