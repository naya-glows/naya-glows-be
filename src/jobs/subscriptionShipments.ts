import { prisma } from "../lib/prisma";
import { sendMail } from "../lib/mailer";
import { subscriptionShipmentEmail } from "../lib/emailTemplates";
import { TERM_LABELS } from "../modules/subscriptions/subscriptionPlans.service";

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// Runs on a daily interval from index.ts (see cartReminders.ts for the same
// pattern) — advances every ACTIVE "recurring"-mode Subscription B plan
// whose next shipment is due: creates that month's Order (already PAID,
// since the customer's card was charged for the whole term upfront at
// purchase time — see subscriptionPlans.service.ts), decrements the
// remaining shipment count, and marks the plan COMPLETED once none are left.
export async function runSubscriptionShipments() {
  const due = await prisma.subscriptionPlan.findMany({
    where: {
      status: "ACTIVE",
      fulfillmentMode: "recurring",
      nextShipmentDate: { lte: new Date() },
    },
    include: { user: { select: { email: true } } },
  });
  if (due.length === 0) return;

  console.log(`[subscription-shipments] ${due.length} plan(s) due for their next shipment.`);

  for (const plan of due) {
    try {
      const items = (plan.items as { slug: string; name: string; qtyPerMonth: number }[]) ?? [];
      const products = await prisma.product.findMany({ where: { slug: { in: items.map((i) => i.slug) } } });
      const productBySlug = new Map(products.map((p) => [p.slug, p]));

      const orderItems = items.flatMap((i) => {
        const product = productBySlug.get(i.slug);
        if (!product) return [];
        // price:0 — already paid in full at plan purchase, this order only
        // represents *what ships*, not an additional charge.
        return [{ productId: product.id, qty: i.qtyPerMonth, price: 0 }];
      });

      await prisma.order.create({
        data: {
          userId: plan.userId,
          status: "PAID",
          paidAt: new Date(),
          currency: "NGN",
          subtotal: 0,
          shipping: 0,
          total: 0,
          subscriptionPlanId: plan.id,
          items: { create: orderItems },
        },
      });

      const remaining = plan.remainingShipments - 1;
      await prisma.subscriptionPlan.update({
        where: { id: plan.id },
        data: {
          remainingShipments: remaining,
          nextShipmentDate: remaining > 0 ? addMonths(new Date(), 1) : null,
          status: remaining > 0 ? "ACTIVE" : "COMPLETED",
        },
      });

      if (plan.user.email) {
        await sendMail({
          to: plan.user.email,
          subject: "Your next Naya Glows shipment is on its way",
          html: subscriptionShipmentEmail(
            TERM_LABELS[plan.term],
            items.map((i) => ({ name: i.name, qty: i.qtyPerMonth })),
          ),
        });
      }
    } catch (err) {
      console.error(`[subscription-shipments] Failed for plan=${plan.id}:`, err);
    }
  }
}
