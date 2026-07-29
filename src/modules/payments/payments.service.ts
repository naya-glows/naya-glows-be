import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { verifyTransaction } from "./paystack";
import { sendMail } from "../../lib/mailer";
import { orderConfirmationEmail } from "../../lib/emailTemplates";

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
    // Fire-and-forget: the customer's payment already succeeded and the
    // order is already marked PAID above — nothing about their experience
    // should wait on an email provider (this was previously awaited here,
    // which is exactly why the verify page's "confirming your payment"
    // spinner hung for as long as the SMTP send took, including its
    // multi-second/-minute timeout on failure).
    if (email) {
      sendMail({
        to: email,
        subject: "Your Naya Glows order is confirmed",
        html: orderConfirmationEmail(updatedOrder),
      }).catch((err) => console.error("[payments] Failed to send order confirmation email:", err));
    }
  }

  return { payment: updatedPayment, order: updatedOrder };
}
