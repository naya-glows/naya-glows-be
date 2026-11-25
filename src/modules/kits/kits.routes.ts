import { Router } from "express";
import { z } from "zod";
import {
  listTreatmentKits,
  listActiveTreatmentKits,
  getKitBySlug,
  createTreatmentKit,
  updateTreatmentKit,
  deleteTreatmentKit,
  listKitEnrollments,
} from "./kits.service";
import { requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../lib/appError";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const kits = await listActiveTreatmentKits();
    res.json({ kits });
  }),
);

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const kit = await getKitBySlug(req.params.slug);
    if (!kit) return res.status(404).json({ error: "Kit not found" });
    res.json({ kit });
  }),
);

export default router;

const kitSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  durationMonths: z.number().int().positive(),
  price: z.number().positive(),
  benefits: z.array(z.string().min(1)).min(1),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export const adminKitsRouter = Router();

adminKitsRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const kits = await listTreatmentKits();
    res.json({ kits });
  }),
);

adminKitsRouter.get(
  "/enrollments",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const enrollments = await listKitEnrollments();
    res.json({ enrollments });
  }),
);

adminKitsRouter.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = kitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const kit = await createTreatmentKit(parsed.data);
      res.status(201).json({ kit });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

adminKitsRouter.put(
  "/:slug",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = kitSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const kit = await updateTreatmentKit(req.params.slug, parsed.data);
      res.json({ kit });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      res.status(404).json({ error: "Kit not found" });
    }
  }),
);

adminKitsRouter.delete(
  "/:slug",
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      await deleteTreatmentKit(req.params.slug);
      res.status(204).send();
    } catch {
      res.status(404).json({ error: "Kit not found" });
    }
  }),
);
