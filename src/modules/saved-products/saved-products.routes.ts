import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";

export const savedProductsRouter = Router();

const toggleSchema = z.object({ slug: z.string().min(1) });

savedProductsRouter.post(
  "/toggle",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = toggleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const product = await prisma.product.findUnique({ where: { slug: parsed.data.slug } });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const userId = req.auth!.userId;
    const existing = await prisma.savedProduct.findUnique({
      where: { userId_productId: { userId, productId: product.id } },
    });

    if (existing) {
      await prisma.savedProduct.delete({ where: { id: existing.id } });
      return res.json({ saved: false });
    }

    await prisma.savedProduct.create({ data: { userId, productId: product.id } });
    res.json({ saved: true });
  }),
);

savedProductsRouter.get(
  "/my",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const saved = await prisma.savedProduct.findMany({
      where: { userId: req.auth!.userId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ products: saved.map((s) => s.product) });
  }),
);
