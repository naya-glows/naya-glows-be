import { Router } from "express";
import { z } from "zod";
import {
  registerUser,
  loginUser,
  requestSignupOtp,
  updateProfile,
  changePassword,
  requestPasswordReset,
  resetPassword,
  serializeUser,
} from "./auth.service";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../lib/appError";

const router = Router();

const otpRequestSchema = z.object({ email: z.string().email() });

// Step 1 of signup — emails a 6-digit code, creates nothing yet. Always
// returns success (never reveals whether the address is already
// registered) except for the one case the frontend needs to react to
// differently: an existing account, which register() would reject anyway.
router.post(
  "/otp/request",
  asyncHandler(async (req, res) => {
    const parsed = otpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      await requestSignupOtp(parsed.data.email);
      res.json({ sent: true });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  country: z.string().optional(),
  referralCode: z.string().optional(),
  otpCode: z.string().length(6),
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
    console.error(`[error] POST /auth/register — email=${parsed.data.email}`, err);
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
    console.error(`[error] POST /auth/login — email=${parsed.data.email}`, err);
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

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  country: z.string().optional(),
});

router.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const user = await updateProfile(req.auth!.userId, parsed.data);
      res.json({ user: serializeUser(user) });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.patch(
  "/me/password",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      await changePassword(req.auth!.userId, parsed.data.currentPassword, parsed.data.newPassword);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

const passwordResetRequestSchema = z.object({ email: z.string().email() });

// Always returns success regardless of whether the email has an account —
// otherwise this endpoint could be used to check which emails are registered.
router.post(
  "/password-reset/request",
  asyncHandler(async (req, res) => {
    const parsed = passwordResetRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      await requestPasswordReset(parsed.data.email);
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      // A resend-cooldown AppError is the one case worth surfacing — it's
      // not an account-existence leak, just rate limiting.
      return res.status(400).json({ error: err.message });
    }
    res.json({ sent: true });
  }),
);

const passwordResetConfirmSchema = z.object({
  email: z.string().email(),
  otpCode: z.string().length(6),
  newPassword: z.string().min(8),
});

router.post(
  "/password-reset/confirm",
  asyncHandler(async (req, res) => {
    const parsed = passwordResetConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      await resetPassword(parsed.data.email, parsed.data.otpCode, parsed.data.newPassword);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

export default router;
