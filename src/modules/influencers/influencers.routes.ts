import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireInfluencer, requireAdmin, type AuthedRequest } from "../../middleware/auth";
import { AppError } from "../../lib/appError";
import { serializeUser } from "../auth/auth.service";
import {
  upgradeToInfluencer,
  getInfluencerByUserId,
  generateReferralCode,
  listOwnReferralCodes,
  listAllInfluencersForAdmin,
} from "./influencers.service";

export const influencersRouter = Router();

const upgradeSchema = z.object({
  platform: z.string().optional(),
  socialHandle: z.string().optional(),
  bio: z.string().optional(),
});

// Signed-in customers only — becoming an influencer never creates a second
// account, it appends an Influencer profile to the one the caller is
// already signed into (gated client-side by redirecting to /signin first).
influencersRouter.post(
  "/upgrade",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = upgradeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const { user, token } = await upgradeToInfluencer(req.auth!.userId, parsed.data);
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
