import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";

const router = Router();

// Admin-only listing for the admin dashboard's Content page.
router.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const blocks = await prisma.contentBlock.findMany({ orderBy: { key: "asc" } });
    res.json({ blocks });
  }),
);

// Public single lookup — used by the frontend's fallback-content pattern.
// Returns 404 (not an error) when no override exists, so callers fall
// straight through to their hardcoded default.
router.get(
  "/:key",
  asyncHandler(async (req, res) => {
    const block = await prisma.contentBlock.findUnique({ where: { key: req.params.key } });
    if (!block) return res.status(404).json({ error: "No override for this key" });
    res.json({ block });
  }),
);

const upsertSchema = z.object({
  data: z.unknown(),
});

router.put(
  "/:key",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const block = await prisma.contentBlock.upsert({
      where: { key: req.params.key },
      create: { key: req.params.key, data: parsed.data.data as object },
      update: { data: parsed.data.data as object },
    });
    res.json({ block });
  }),
);

router.delete(
  "/:key",
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      await prisma.contentBlock.delete({ where: { key: req.params.key } });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: "Not found" });
    }
  }),
);

export default router;
