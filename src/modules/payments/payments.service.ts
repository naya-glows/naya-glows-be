import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { verifyTransaction, refundTransaction } from "./paystack";
import { sendMail } from "../../lib/mailer";
import { AppError } from "../../lib/appError";
import {
  orderConfirmationEmail,
  subscriptionCodeEmail,
  subscriptionPlanConfirmationEmail,
  refundProcessedEmail,
} from "../../lib/emailTemplates";
import { createProductSubscriptionsForOrder } from "../subscriptions/productSubscriptions.service";
import { getPlanByOrderId, TERM_LABELS } from "../subscriptions/subscriptionPlans.service";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function verifyPaystackSignature(rawBody: Buffer, signature: string | undefined): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;

  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");

  // Constant-time comparison — a plain `===` leaks how many leading bytes
  // matched via response timing, which (over enough attempts) is a known
  // attack against hand-rolled signature checks. Lengths must match first:
  // timingSafeEqual throws on mismatched buffer lengths rather than
  // returning false, and an attacker-controlled header is never guaranteed
  // to be valid hex of the right length.
  const expected = Buffer.from(hash, "hex");
  const received = Buffer.from(signature, "hex");
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
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
  // Paystack confirming "success" on its own isn't enough — the reference
  // alone doesn't pin the amount, and the Inline JS call that set it in the
  // browser is client-side code, interceptable like any other (devtools,
  // a modified request before the modal opens, etc). Without this check,
  // someone could tamper with the amount actually sent to Paystack, pay a
  // fraction of the order total, still get a genuine "success" back for
  // that smaller charge, and have it accepted as payment in full for the
  // real order total. Require the amount AND currency Paystack actually
  // confirms to match what this payment was created for (in kobo, same
  // unit Paystack reports in) before treating it as paid.
  const expectedAmountKobo = Math.round(payment.amount * 100);
  const succeeded =
    result.status === "success" &&
    result.amount === expectedAmountKobo &&
    result.currency === payment.currency;

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
        html: orderConfirmationEmail(updatedOrder, email),
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

// `amount` (Naira) is optional — omitted means a full refund of the order's
// remaining unrefunded balance. Used both by the admin's direct "refund this
// order" action and by cancelSubscriptionPlan's prorated refund.
export async function refundOrder(orderId: string, amount?: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true },
  });
  if (!order) throw new AppError("Order not found");
  if (order.status !== "PAID") {
    throw new AppError("Only a paid order can be refunded. This one is " + order.status.toLowerCase());
  }

  const payment = order.payments.find((p) => p.status === "SUCCESS" || p.status === "REFUNDED");
  if (!payment || !payment.providerReference) {
    throw new AppError("No successful payment found for this order to refund");
  }

  const alreadyRefunded = payment.refundedAmount;
  const remaining = round2(payment.amount - alreadyRefunded);
  const refundAmount = amount !== undefined ? round2(amount) : remaining;

  if (refundAmount <= 0) throw new AppError("Nothing left to refund on this order");
  if (refundAmount > remaining) {
    throw new AppError(`Can't refund more than the ${payment.currency} ${remaining.toLocaleString()} remaining`);
  }

  // Omit the amount to Paystack on what we know is a full refund (of the
  // whole original charge, not just "the remaining balance") — asking
  // Paystack to compute it avoids any kobo-rounding mismatch with what it
  // actually charged.
  const isFullRefundOfOriginalCharge = refundAmount === remaining && alreadyRefunded === 0;
  await refundTransaction(
    payment.providerReference,
    isFullRefundOfOriginalCharge ? undefined : Math.round(refundAmount * 100),
  );

  const newRefundedTotal = round2(alreadyRefunded + refundAmount);
  const isFullyRefunded = newRefundedTotal >= payment.amount;

  const [updatedPayment, updatedOrder] = await Promise.all([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "REFUNDED",
        refundedAmount: newRefundedTotal,
        refundedAt: new Date(),
      },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: {
        status: isFullyRefunded ? "REFUNDED" : order.status,
        refundedAt: new Date(),
      },
    }),
  ]);

  const shippingDetails = order.shippingDetails as { email?: string } | null;
  if (shippingDetails?.email) {
    sendMail({
      to: shippingDetails.email,
      subject: isFullyRefunded ? "Your Naya Glows order has been refunded" : "A refund has been issued",
      html: refundProcessedEmail(order, refundAmount, order.currency, isFullyRefunded),
    }).catch((err) => console.error("[payments] Failed to send refund email:", err));
  }

  return { payment: updatedPayment, order: updatedOrder, refundAmount };
}
