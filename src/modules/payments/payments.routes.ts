import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { confirmPaystackPayment } from "./payments.service";
import { initializeTransaction } from "./paystack";

export const paymentsRouter = Router();

const initializeSchema = z.object({ orderId: z.string().min(1) });

// Creates the pending Payment row, then asks Paystack to start the
// transaction on ITS hosted checkout page (a redirect, not the old Inline JS
// popup) — Inline's iframe is a documented failure mode: it can hang
// indefinitely mid-3-D-Secure/OTP with neither its success nor cancel
// callback ever firing, leaving the customer on a frozen "placing order"
// screen with no way to tell whether they were charged (confirmed in
// production on a sister project, same provider, same SDK). A redirect to
// Paystack's own page can't get stuck that way — the customer always ends
// up back on /checkout/verify (see callback_url below) one way or another.
//
// Both routes require auth and check order ownership — an order ID alone
// (a cuid) shouldn't be enough for anyone to read another customer's email/
// amount or re-trigger a payment reference for their order. "Not found" is
// returned for a mismatched owner too, so an ID probe can't distinguish
// "doesn't exist" from "exists but isn't yours".
paymentsRouter.post(
  "/paystack/initialize",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = initializeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } });
    if (!order || order.userId !== req.auth!.userId) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.status === "PAID") {
      return res.status(400).json({ error: "This order has already been paid" });
    }

    const shippingDetails = order.shippingDetails as { email?: string } | null;
    const email = shippingDetails?.email;
    if (!email) return res.status(400).json({ error: "Order is missing a contact email" });

    const reference = `naya-${order.id}-${randomUUID()}`;

    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "paystack",
        providerReference: reference,
        amount: order.total,
        currency: order.currency,
        status: "PENDING",
      },
    });

    // The first entry in CORS_ORIGIN is this app's own canonical frontend
    // origin (see app.ts — it's required, comma-separated when there's more
    // than one, e.g. a preview URL alongside the real domain), so this
    // always lands back on the right host for whichever environment is
    // actually running, local dev included, with no separate env var.
    const frontendOrigin = process.env.CORS_ORIGIN!.split(",")[0].trim();
    const { authorization_url: authorizationUrl } = await initializeTransaction({
      email,
      amountKobo: Math.round(order.total * 100),
      currency: order.currency,
      reference,
      callbackUrl: `${frontendOrigin}/checkout/verify`,
    });

    res.json({ authorizationUrl });
  }),
);

paymentsRouter.get(
  "/paystack/verify/:reference",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await confirmPaystackPayment(req.params.reference);
    const isOwner = result?.order.userId === req.auth!.userId;
    const isAdmin = req.auth!.role === "ADMIN";
    if (!result || !(isOwner || isAdmin)) {
      return res.status(404).json({ error: "Payment not found" });
    }
    res.json(result);
  }),
);
