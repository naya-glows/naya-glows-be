import crypto from "crypto";
import { waitUntil } from "@vercel/functions";
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
import { createKitEnrollmentsForOrder } from "../kits/kits.service";
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

  // Atomic claim, not a plain update: the webhook and the frontend's own
  // /verify call can both reach this point within the same race window
  // (both passed the `status === "SUCCESS"` check above before either
  // wrote anything). `updateMany` with this `where` only matches — and
  // only returns count 1 for — whichever call's UPDATE statement the DB
  // actually applies first; the loser sees the row already moved out of
  // its pre-claim state and backs off instead of re-running the order
  // update and side effects (duplicate confirmation email, double
  // Subscription A enrollment) below.
  const claim = await prisma.payment.updateMany({
    where: { id: payment.id, status: { not: "SUCCESS" } },
    data: { status: succeeded ? "SUCCESS" : "FAILED" },
  });

  if (claim.count === 0) {
    const [currentPayment, currentOrder] = await Promise.all([
      prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } }),
    ]);
    return { payment: currentPayment, order: currentOrder };
  }

  const updatedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });

  const updatedOrder = await prisma.order.update({
    where: { id: payment.orderId },
    data: { status: succeeded ? "PAID" : "FAILED", paidAt: succeeded ? new Date() : undefined },
    include: { items: { include: { product: { select: { name: true, slug: true, isKit: true } } } } },
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
      waitUntil(
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
        }).catch((err) => console.error("[payments] Failed to send plan confirmation email:", err)),
      );
    } else if (email) {
      waitUntil(
        sendMail({
          to: email,
          subject: "Your Naya Glows order is confirmed",
          html: orderConfirmationEmail(updatedOrder, email),
        }).catch((err) => console.error("[payments] Failed to send order confirmation email:", err)),
      );
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
        waitUntil(
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
            .catch((err) => console.error("[payments] Failed to create product subscription(s):", err)),
        );
      }
    }

    // Treatment Kit enrollment — same fire-and-forget side-effect shape as
    // Subscription A above. KitEnrollment.userId is required, so a guest
    // checkout (no account) simply never gets one; a kit purchased without
    // an account has no ongoing specialist-access window to track anyway.
    if (updatedOrder.userId) {
      const kitProductSlugs = updatedOrder.items
        .filter((item) => item.product.isKit)
        .map((item) => item.product.slug);
      if (kitProductSlugs.length > 0) {
        waitUntil(
          createKitEnrollmentsForOrder(updatedOrder.userId, updatedOrder.id, kitProductSlugs).catch((err) =>
            console.error("[payments] Failed to create kit enrollment(s):", err),
          ),
        );
      }
    }
  }

  return { payment: updatedPayment, order: updatedOrder };
}

// Fallback for the gap where neither of the two normal confirmation paths
// ever fires: Paystack's webhook delivery fails (or, right after a hosting
// migration, is briefly misconfigured) AND the customer's browser never
// completes its own /verify call (closed tab, crash, dropped connection
// right after paying). Without this, such an order sits PENDING forever
// even though the card was actually charged. Run from the daily cron —
// confirmPaystackPayment already re-verifies against Paystack and is
// idempotent/atomically-claimed, so calling it here is exactly as safe as
// the webhook or /verify calling it.
const STALE_PENDING_THRESHOLD_MS = 20 * 60 * 1000;

export async function reconcileStalePendingOrders() {
  const cutoff = new Date(Date.now() - STALE_PENDING_THRESHOLD_MS);
  const stale = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      providerReference: { not: null },
      createdAt: { lt: cutoff },
      order: { status: "PENDING" },
    },
    select: { providerReference: true },
  });

  let resolved = 0;
  for (const { providerReference } of stale) {
    try {
      const result = await confirmPaystackPayment(providerReference!);
      if (result?.payment.status === "SUCCESS" || result?.payment.status === "FAILED") resolved += 1;
    } catch (err) {
      console.error(`[reconcile] Failed checking reference=${providerReference}:`, err);
    }
  }

  if (stale.length > 0) {
    console.log(`[reconcile] Checked ${stale.length} stale-pending order(s), resolved ${resolved}.`);
  }
  return { checked: stale.length, resolved };
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
    waitUntil(
      sendMail({
        to: shippingDetails.email,
        subject: isFullyRefunded ? "Your Naya Glows order has been refunded" : "A refund has been issued",
        html: refundProcessedEmail(order, refundAmount, order.currency, isFullyRefunded),
      }).catch((err) => console.error("[payments] Failed to send refund email:", err)),
    );
  }

  return { payment: updatedPayment, order: updatedOrder, refundAmount };
}
