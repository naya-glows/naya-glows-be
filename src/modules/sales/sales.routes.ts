import { Router } from "express";
import { z } from "zod";
import {
  listSales,
  listCurrentlyActiveSales,
  getSaleBySlug,
  createSale,
  updateSale,
  deleteSale,
} from "./sales.service";
import { requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../lib/asyncHandler";

const router = Router();

router.get(
  "/active",
  asyncHandler(async (_req, res) => {
    const sales = await listCurrentlyActiveSales();
    res.json({ sales });
  }),
);

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const sale = await getSaleBySlug(req.params.slug);
    if (!sale) return res.status(404).json({ error: "Sale not found" });
    res.json({ sale });
  }),
);

export default router;

const saleSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  discountPercent: z.number().min(0).max(100),
  productSlugs: z.array(z.string().min(1)).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isActive: z.boolean().optional(),
  bannerHeadline: z.string().min(1),
  bannerCopy: z.string().min(1),
  bannerImage: z.string().nullable().optional(),
});

export const adminSalesRouter = Router();

adminSalesRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const sales = await listSales();
    res.json({ sales });
  }),
);

adminSalesRouter.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const sale = await createSale(parsed.data);
    res.status(201).json({ sale });
  }),
);

adminSalesRouter.put(
  "/:slug",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = saleSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const sale = await updateSale(req.params.slug, parsed.data);
      res.json({ sale });
    } catch {
      res.status(404).json({ error: "Sale not found" });
    }
  }),
);

adminSalesRouter.delete(
  "/:slug",
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      await deleteSale(req.params.slug);
      res.status(204).send();
    } catch {
      res.status(404).json({ error: "Sale not found" });
    }
  }),
);
