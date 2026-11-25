import { Router } from "express";
import { z } from "zod";
import {
  listActiveReservationKits,
  listReservationKits,
  createReservationKit,
  updateReservationKit,
  deleteReservationKit,
  listReservations,
  getReservationById,
  createReservation,
  initiateReservationPayment,
  verifyReservationPayment,
} from "./reservations.service";
import { requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../lib/appError";

const router = Router();

router.get(
  "/kits",
  asyncHandler(async (_req, res) => {
    const kits = await listActiveReservationKits();
    res.json({ kits });
  }),
);

const createReservationSchema = z.object({
  kitSlug: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createReservationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const reservation = await createReservation(parsed.data);
      res.status(201).json({ reservation });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const reservation = await getReservationById(req.params.id);
    if (!reservation) return res.status(404).json({ error: "Reservation not found" });
    res.json({ reservation });
  }),
);

router.post(
  "/:id/pay",
  asyncHandler(async (req, res) => {
    const frontendOrigin = process.env.CORS_ORIGIN!.split(",")[0].trim();
    try {
      const result = await initiateReservationPayment(
        req.params.id,
        `${frontendOrigin}/black-friday/verify?reservationId=${encodeURIComponent(req.params.id)}`,
      );
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

router.get(
  "/:id/verify",
  asyncHandler(async (req, res) => {
    const reference = String(req.query.reference || "");
    if (!reference) return res.status(400).json({ error: "Missing reference" });
    try {
      const reservation = await verifyReservationPayment(req.params.id, reference);
      res.json({ reservation });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

export default router;

const kitSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  totalPrice: z.number().positive(),
  depositAmount: z.number().positive(),
  publicPrice: z.number().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export const adminReservationsRouter = Router();

adminReservationsRouter.get(
  "/kits",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const kits = await listReservationKits();
    res.json({ kits });
  }),
);

adminReservationsRouter.post(
  "/kits",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = kitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const kit = await createReservationKit(parsed.data);
    res.status(201).json({ kit });
  }),
);

adminReservationsRouter.put(
  "/kits/:slug",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = kitSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const kit = await updateReservationKit(req.params.slug, parsed.data);
      res.json({ kit });
    } catch {
      res.status(404).json({ error: "Reservation kit not found" });
    }
  }),
);

adminReservationsRouter.delete(
  "/kits/:slug",
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      await deleteReservationKit(req.params.slug);
      res.status(204).send();
    } catch {
      res.status(404).json({ error: "Reservation kit not found" });
    }
  }),
);

adminReservationsRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const reservations = await listReservations();
    res.json({ reservations });
  }),
);
