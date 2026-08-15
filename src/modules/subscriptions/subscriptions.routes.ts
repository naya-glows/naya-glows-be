import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin, type AuthedRequest } from "../../middleware/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../lib/appError";
import { listMyProductSubscriptions } from "./productSubscriptions.service";
import {
  quotePlan,
  createSubscriptionPlanOrder,
  listMyPlans,
  listAllPlansForAdmin,
} from "./subscriptionPlans.service";
import { prisma } from "../../lib/prisma";

export const subscriptionsRouter = Router();

// "Subscription A" — the customer's own standing repeat-purchase discounts.
subscriptionsRouter.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const subscriptions = await listMyProductSubscriptions(req.auth!.userId);
    res.json({ subscriptions });
  }),
);

const planItemsSchema = z
  .array(z.object({ slug: z.string().min(1), qtyPerMonth: z.number().int().positive() }))
  .min(1);
const termSchema = z.enum(["THREE_MONTH", "SIX_MONTH", "TWELVE_MONTH"]);

const quoteSchema = z.object({ term: termSchema, items: planItemsSchema });

// Public — a live cost/discount preview while the customer is still
// choosing products and a term, before they commit to anything.
subscriptionsRouter.post(
  "/plans/quote",
  asyncHandler(async (req, res) => {
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const quote = await quotePlan(parsed.data.term, parsed.data.items);
      res.json({ quote });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

const shippingDetailsSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
});

const createPlanSchema = z.object({
  term: termSchema,
  items: planItemsSchema,
  shippingDetails: shippingDetailsSchema,
});

subscriptionsRouter.post(
  "/plans",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = createPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const { order, plan } = await createSubscriptionPlanOrder(
        req.auth!.userId,
        parsed.data.term,
        parsed.data.items,
        parsed.data.shippingDetails,
      );
      res.status(201).json({ order, plan });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

subscriptionsRouter.get(
  "/plans/mine",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const plans = await listMyPlans(req.auth!.userId);
    res.json({ plans });
  }),
);

export const adminSubscriptionsRouter = Router();

adminSubscriptionsRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [productSubscriptions, plans] = await Promise.all([
      prisma.productSubscription.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          product: { select: { name: true, slug: true } },
        },
      }),
      listAllPlansForAdmin(),
    ]);
    res.json({ productSubscriptions, plans });
  }),
);
