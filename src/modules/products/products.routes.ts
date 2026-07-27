import { Router } from "express";
import { z } from "zod";
import {
  listActiveProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
} from "./products.service";
import { requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../lib/asyncHandler";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const products = await listActiveProducts();
    res.json({ products });
  }),
);

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const product = await getProductBySlug(req.params.slug);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ product });
  }),
);

const productSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  categoryAccent: z.string().optional(),
  price: z.number().positive(),
  originalPrice: z.number().positive(),
  image: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  benefits: z.array(z.string()),
  variants: z
    .array(z.object({ name: z.string().min(1), price: z.number().positive() }))
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});

router.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const product = await createProduct(parsed.data);
    res.status(201).json({ product });
  }),
);

router.put(
  "/:slug",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const product = await updateProduct(req.params.slug, parsed.data);
      res.json({ product });
    } catch {
      res.status(404).json({ error: "Product not found" });
    }
  }),
);

router.delete(
  "/:slug",
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      await deleteProduct(req.params.slug);
      res.status(204).send();
    } catch {
      res.status(404).json({ error: "Product not found" });
    }
  }),
);

export default router;
