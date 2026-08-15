import { Router } from "express";
import { requireAdmin } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";

const router = Router();

router.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        country: true,
        currency: true,
        createdAt: true,
      },
    });
    res.json({ users });
  }),
);

export default router;
