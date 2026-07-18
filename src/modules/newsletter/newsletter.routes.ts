import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin } from "../../middleware/auth";

const subscribeSchema = z.object({ email: z.string().email() });

export const newsletterRouter = Router();

newsletterRouter.post(
  "/subscribe",
  asyncHandler(async (req, res) => {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    // Idempotent — resubscribing is a silent no-op, not an error.
    await prisma.newsletterSubscriber.upsert({
      where: { email: parsed.data.email },
      create: { email: parsed.data.email },
      update: {},
    });

    res.status(201).json({ subscribed: true });
  }),
);

export const adminNewsletterRouter = Router();

adminNewsletterRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const subscribers = await prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ subscribers });
  }),
);
