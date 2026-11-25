import { Router } from "express";
import { z } from "zod";
import {
  listActiveConsultationTypes,
  listConsultationTypes,
  updateConsultationType,
  listConsultationBlocks,
  createConsultationBlock,
  deleteConsultationBlock,
  getAvailableSlots,
  createConsultationBooking,
  initiateConsultationPayment,
  verifyConsultationPayment,
  getConsultationById,
  listConsultations,
  rescheduleConsultation,
  cancelConsultation,
} from "./consultations.service";
import { requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../lib/appError";

export const consultationsRouter = Router();

consultationsRouter.get(
  "/types",
  asyncHandler(async (_req, res) => {
    const types = await listActiveConsultationTypes();
    res.json({ types });
  }),
);

consultationsRouter.get(
  "/availability",
  asyncHandler(async (req, res) => {
    const date = String(req.query.date || "");
    const typeSlug = String(req.query.typeSlug || "");
    if (!date || !typeSlug) return res.status(400).json({ error: "date and typeSlug are required" });
    try {
      const slots = await getAvailableSlots(date, typeSlug);
      res.json({ slots });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

const bookingSchema = z.object({
  consultationTypeSlug: z.string().min(1),
  scheduledDate: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  skinConcern: z.string().min(1),
  message: z.string().optional(),
});

consultationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = bookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const request = await createConsultationBooking(parsed.data);
      res.status(201).json({ request });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

consultationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const request = await getConsultationById(req.params.id);
    if (!request) return res.status(404).json({ error: "Booking not found" });
    res.json({ request });
  }),
);

consultationsRouter.post(
  "/:id/pay",
  asyncHandler(async (req, res) => {
    const frontendOrigin = process.env.CORS_ORIGIN!.split(",")[0].trim();
    try {
      const result = await initiateConsultationPayment(
        req.params.id,
        `${frontendOrigin}/consultation/verify?requestId=${encodeURIComponent(req.params.id)}`,
      );
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

consultationsRouter.get(
  "/:id/verify",
  asyncHandler(async (req, res) => {
    const reference = String(req.query.reference || "");
    if (!reference) return res.status(400).json({ error: "Missing reference" });
    try {
      const request = await verifyConsultationPayment(req.params.id, reference);
      res.json({ request });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

export const adminConsultationsRouter = Router();

adminConsultationsRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const requests = await listConsultations();
    res.json({ requests });
  }),
);

adminConsultationsRouter.get(
  "/types",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const types = await listConsultationTypes();
    res.json({ types });
  }),
);

const updateTypeSchema = z.object({
  name: z.string().min(1).optional(),
  feeNgn: z.number().positive().optional(),
  durationMinutes: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

adminConsultationsRouter.put(
  "/types/:slug",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = updateTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const type = await updateConsultationType(req.params.slug, parsed.data);
    res.json({ type });
  }),
);

adminConsultationsRouter.get(
  "/blocks",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const blocks = await listConsultationBlocks();
    res.json({ blocks });
  }),
);

const blockSchema = z.object({
  date: z.coerce.date(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  reason: z.string().optional(),
});

adminConsultationsRouter.post(
  "/blocks",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = blockSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const block = await createConsultationBlock(parsed.data);
    res.status(201).json({ block });
  }),
);

adminConsultationsRouter.delete(
  "/blocks/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    await deleteConsultationBlock(req.params.id);
    res.status(204).send();
  }),
);

const rescheduleSchema = z.object({ scheduledDate: z.coerce.date() });

adminConsultationsRouter.put(
  "/:id/reschedule",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = rescheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const request = await rescheduleConsultation(req.params.id, parsed.data.scheduledDate);
    res.json({ request });
  }),
);

adminConsultationsRouter.post(
  "/:id/cancel",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const request = await cancelConsultation(req.params.id);
    res.json({ request });
  }),
);
