import { Router } from "express";
import { z } from "zod";
import { registerUser, loginUser, serializeUser } from "./auth.service";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../lib/appError";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  country: z.string().optional(),
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }

  try {
    const { user, token } = await registerUser(parsed.data);
    res.status(201).json({ user: serializeUser(user), token });
  } catch (err) {
    if (err instanceof AppError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }

  try {
    const { user, token } = await loginUser(parsed.data.email, parsed.data.password);
    res.json({ user: serializeUser(user), token });
  } catch (err) {
    if (err instanceof AppError) return res.status(401).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: serializeUser(user) });
  }),
);

export default router;
