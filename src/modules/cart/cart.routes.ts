import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import { syncCart } from "./cart.service";

export const cartRouter = Router();

const syncSchema = z.object({
  items: z.array(
    z.object({
      slug: z.string().min(1),
      name: z.string().min(1),
      qty: z.number().int().positive(),
    }),
  ),
});

// Mirrors the signed-in customer's cart server-side, purely so the backend
// can notice an abandoned one — the frontend's cartSlice.ts stays the real
// source of truth for the live shopping experience.
cartRouter.put(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = syncSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    await syncCart(req.auth!.userId, parsed.data.items);
    res.json({ ok: true });
  }),
);
