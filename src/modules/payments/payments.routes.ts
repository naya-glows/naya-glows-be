import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { initializeTransaction } from "./paystack";
import { confirmPaystackPayment } from "./payments.service";

export const paymentsRouter = Router();

const initializeSchema = z.object({ orderId: z.string().min(1) });

paymentsRouter.post(
  "/paystack/initialize",
  asyncHandler(async (req, res) => {
    const parsed = initializeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status === "PAID") {
      return res.status(400).json({ error: "This order has already been paid" });
    }

    const shippingDetails = order.shippingDetails as { email?: string } | null;
    const email = shippingDetails?.email;
    if (!email) return res.status(400).json({ error: "Order is missing a contact email" });

    const reference = `naya-${order.id}-${randomUUID()}`;
    const frontendUrl = process.env.CORS_ORIGIN?.split(",")[0] ?? "http://localhost:3000";

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

    try {
      const data = await initializeTransaction({
        email,
        amountMinorUnits: Math.round(order.total * 100),
        currency: order.currency,
        reference,
        callbackUrl: `${frontendUrl}/checkout/verify`,
      });
      res.json({ authorizationUrl: data.authorization_url, reference });
    } catch (err) {
      await prisma.payment.update({
        where: { providerReference: reference },
        data: { status: "FAILED" },
      });
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to start payment with Paystack",
      });
    }
  }),
);

paymentsRouter.get(
  "/paystack/verify/:reference",
  asyncHandler(async (req, res) => {
    const result = await confirmPaystackPayment(req.params.reference);
    if (!result) return res.status(404).json({ error: "Payment not found" });
    res.json(result);
  }),
);
