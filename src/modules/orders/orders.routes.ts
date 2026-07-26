import { Router } from "express";
import { z } from "zod";
import {
  createOrder,
  listOrdersForAdmin,
  listOrdersForUser,
  getOrderById,
  setOrderManualStage,
} from "./orders.service";
import { computeTracking, TRACKING_STAGE_KEYS } from "./tracking";
import { optionalAuth, requireAuth, requireAdmin, type AuthedRequest } from "../../middleware/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../lib/appError";

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

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        slug: z.string().min(1),
        qty: z.number().int().positive(),
        isSubscription: z.boolean().optional(),
      }),
    )
    .min(1),
  shippingDetails: shippingDetailsSchema,
});

export const ordersRouter = Router();

ordersRouter.post(
  "/",
  optionalAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    try {
      const order = await createOrder({
        items: parsed.data.items,
        shippingDetails: parsed.data.shippingDetails,
        userId: req.auth?.userId,
      });
      res.status(201).json({ order });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

// A logged-in customer's own order history — distinct from the public
// email-verified /track/:id lookup below, which also serves guest orders.
ordersRouter.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const orders = await listOrdersForUser(req.auth!.userId);
    res.json({ orders });
  }),
);

// Public, guest-friendly: requires the order's own contact email as a
// lightweight proof of ownership rather than a full login.
ordersRouter.get(
  "/track/:id",
  asyncHandler(async (req, res) => {
    const email = String(req.query.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ error: "Email is required" });

    const order = await getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const shippingDetails = order.shippingDetails as { email?: string } | null;
    const ownerEmail = (order.user?.email || shippingDetails?.email || "").toLowerCase();
    if (ownerEmail !== email) {
      return res.status(404).json({ error: "Order not found" });
    }

    const tracking = computeTracking(order.paidAt, order.status, order.manualStage);
    res.json({
      order: {
        id: order.id,
        status: order.status,
        total: order.total,
        currency: order.currency,
        items: order.items,
      },
      tracking,
    });
  }),
);

export const adminOrdersRouter = Router();

adminOrdersRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const orders = await listOrdersForAdmin();
    res.json({ orders });
  }),
);

const trackingStageSchema = z.object({
  stage: z.enum(TRACKING_STAGE_KEYS as [string, ...string[]]).nullable(),
});

adminOrdersRouter.put(
  "/:id/tracking",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = trackingStageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const order = await setOrderManualStage(req.params.id, parsed.data.stage);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ order });
  }),
);
