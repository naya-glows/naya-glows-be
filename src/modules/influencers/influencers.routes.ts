import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireInfluencer, requireAdmin, type AuthedRequest } from "../../middleware/auth";
import { AppError } from "../../lib/appError";
import { serializeUser } from "../auth/auth.service";
import {
  registerInfluencer,
  getInfluencerByUserId,
  generateReferralCode,
  listOwnReferralCodes,
  listAllInfluencersForAdmin,
} from "./influencers.service";

export const influencersRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  platform: z.string().optional(),
  socialHandle: z.string().optional(),
  bio: z.string().optional(),
});

influencersRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const { user, token } = await registerInfluencer(parsed.data);
      res.status(201).json({ user: serializeUser(user), token });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

influencersRouter.get(
  "/me",
  requireInfluencer,
  asyncHandler(async (req: AuthedRequest, res) => {
    const influencer = await getInfluencerByUserId(req.auth!.userId);
    if (!influencer) return res.status(404).json({ error: "Influencer profile not found" });
    res.json({
      influencer: {
        id: influencer.id,
        name: influencer.user.name,
        email: influencer.user.email,
        platform: influencer.platform,
        socialHandle: influencer.socialHandle,
        bio: influencer.bio,
        createdAt: influencer.createdAt,
      },
    });
  }),
);

influencersRouter.get(
  "/codes",
  requireInfluencer,
  asyncHandler(async (req: AuthedRequest, res) => {
    const codes = await listOwnReferralCodes(req.auth!.userId);
    res.json({ codes });
  }),
);

influencersRouter.post(
  "/codes",
  requireInfluencer,
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      const code = await generateReferralCode(req.auth!.userId);
      res.status(201).json({ code: { id: code.id, code: code.code, createdAt: code.createdAt, signupCount: 0 } });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

export const adminInfluencersRouter = Router();

adminInfluencersRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const influencers = await listAllInfluencersForAdmin();
    res.json({ influencers });
  }),
);
