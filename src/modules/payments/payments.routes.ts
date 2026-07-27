import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { confirmPaystackPayment } from "./payments.service";

export const paymentsRouter = Router();

const initializeSchema = z.object({ orderId: z.string().min(1) });

// Creates the pending Payment row + a reference the frontend hands straight
// to Paystack's Inline JS (no server-to-server "initialize transaction" call
// needed for that flow — Inline opens its own modal/iframe directly from the
// public key). The secret key is only ever used server-side, in `verify`.
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

    res.json({ reference, email, amount: order.total, currency: order.currency });
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
