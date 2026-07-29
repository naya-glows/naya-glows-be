import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { verifyTransaction } from "./paystack";
import { sendMail } from "../../lib/mailer";
import {
  orderConfirmationEmail,
  subscriptionCodeEmail,
  subscriptionPlanConfirmationEmail,
} from "../../lib/emailTemplates";
import { createProductSubscriptionsForOrder } from "../subscriptions/productSubscriptions.service";
import { getPlanByOrderId, TERM_LABELS } from "../subscriptions/subscriptionPlans.service";

export function verifyPaystackSignature(rawBody: Buffer, signature: string | undefined): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;

  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  return hash === signature;
}

// Idempotent: safe to call from both the verify endpoint (frontend redirect)
// and the webhook (authoritative server-to-server confirmation) — whichever
// arrives first wins, the second call is a no-op.
export async function confirmPaystackPayment(reference: string) {
  const payment = await prisma.payment.findUnique({
    where: { providerReference: reference },
    include: { order: true },
  });
  if (!payment) return null;

  if (payment.status === "SUCCESS") {
    return { payment, order: payment.order };
  }

  const result = await verifyTransaction(reference);
  const succeeded = result.status === "success";

  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: succeeded ? "SUCCESS" : "FAILED" },
  });

  const updatedOrder = await prisma.order.update({
    where: { id: payment.orderId },
    data: { status: succeeded ? "PAID" : "FAILED", paidAt: succeeded ? new Date() : undefined },
    include: { items: { include: { product: { select: { name: true } } } } },
  });

  if (succeeded) {
    const shippingDetails = updatedOrder.shippingDetails as { email?: string } | null;
    const email = shippingDetails?.email;

    // A "Subscription B" plan order (see subscriptionPlans.service.ts) gets
    // its own confirmation email instead of the generic one below — its
    // total doesn't map 1:1 to "these line items at these prices" the way
    // a normal order's does, so the generic template would be misleading.
    const plan = updatedOrder.subscriptionPlanId ? await getPlanByOrderId(updatedOrder.id) : null;

    // Fire-and-forget: the customer's payment already succeeded and the
    // order is already marked PAID above — nothing about their experience
    // should wait on an email provider (this was previously awaited here,
    // which is exactly why the verify page's "confirming your payment"
    // spinner hung for as long as the SMTP send took, including its
    // multi-second/-minute timeout on failure).
    if (email && plan) {
      sendMail({
        to: email,
        subject: "Your Subscribe & Save plan is confirmed",
        html: subscriptionPlanConfirmationEmail({
          termLabel: TERM_LABELS[plan.term],
          totalPaid: plan.totalPaid,
          currency: updatedOrder.currency,
          fulfillmentMode: plan.fulfillmentMode,
          items: (plan.items as { name: string; qtyPerMonth: number }[]) ?? [],
        }),
      }).catch((err) => console.error("[payments] Failed to send plan confirmation email:", err));
    } else if (email) {
      sendMail({
        to: email,
        subject: "Your Naya Glows order is confirmed",
        html: orderConfirmationEmail(updatedOrder),
      }).catch((err) => console.error("[payments] Failed to send order confirmation email:", err));
    }

    // "Subscription A" enrollment — items.isSubscription here means "this
    // is the customer's qualifying first purchase of this product" (see
    // orders.service.ts's createOrder), so this order itself was never
    // discounted; it's what unlocks the standing discount for every
    // purchase after. Never relevant for a Subscription B plan order.
    // Fire-and-forget for the same reason as the email above — this is a
    // side effect of the payment, not something the customer should wait on.
    if (updatedOrder.userId && !plan) {
      const subscribeProductIds = updatedOrder.items
        .filter((item) => item.isSubscription)
        .map((item) => item.productId);
      if (subscribeProductIds.length > 0) {
        createProductSubscriptionsForOrder(updatedOrder.userId, updatedOrder.id, subscribeProductIds)
          .then((created) => {
            if (created.length > 0 && email) {
              const items = created.map((c) => ({
                name: updatedOrder.items.find((i) => i.productId === c.productId)?.product.name ?? "",
                code: c.code,
              }));
              return sendMail({
                to: email,
                subject: "You've unlocked a reorder discount",
                html: subscriptionCodeEmail(items),
              });
            }
          })
          .catch((err) => console.error("[payments] Failed to create product subscription(s):", err));
      }
    }
  }

  return { payment: updatedPayment, order: updatedOrder };
}
