import { Router } from "express";
import { z } from "zod";
import { listCombos, listActiveCombos, getComboBySlug, createCombo, updateCombo, deleteCombo } from "./combos.service";
import { requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../lib/appError";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const combos = await listActiveCombos();
    res.json({ combos });
  }),
);

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const combo = await getComboBySlug(req.params.slug);
    if (!combo) return res.status(404).json({ error: "Combo not found" });
    res.json({ combo });
  }),
);

export default router;

const comboSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  coverImage: z.string().nullable().optional(),
  price: z.number().positive(),
  productSlugs: z.array(z.string().min(1)).min(2),
  isActive: z.boolean().optional(),
});

export const adminCombosRouter = Router();

adminCombosRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const combos = await listCombos();
    res.json({ combos });
  }),
);

adminCombosRouter.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = comboSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const combo = await createCombo(parsed.data);
      res.status(201).json({ combo });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

adminCombosRouter.put(
  "/:slug",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = comboSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const combo = await updateCombo(req.params.slug, parsed.data);
      res.json({ combo });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      res.status(404).json({ error: "Combo not found" });
    }
  }),
);

adminCombosRouter.delete(
  "/:slug",
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      await deleteCombo(req.params.slug);
      res.status(204).send();
    } catch {
      res.status(404).json({ error: "Combo not found" });
    }
  }),
);
