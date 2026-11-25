import { Router } from "express";
import { z } from "zod";
import {
  listCampaigns,
  getCampaignById,
  getActiveCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from "./campaigns.service";
import { requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../lib/asyncHandler";

const router = Router();

router.get(
  "/active",
  asyncHandler(async (_req, res) => {
    const campaign = await getActiveCampaign();
    res.json({ campaign });
  }),
);

export default router;

const socialLinkSchema = z.object({ platform: z.string().min(1), url: z.string().url() });

const campaignSchema = z.object({
  name: z.string().min(1),
  isActive: z.boolean().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  popupHeadline: z.string().min(1),
  popupCopy: z.string().min(1),
  popupImage: z.string().nullable().optional(),
  ctaText: z.string().min(1),
  landingPath: z.string().min(1),
  rewardValueNgn: z.number().int().positive().optional(),
  codeValidDays: z.number().int().positive().optional(),
  redemptionRules: z.string().nullable().optional(),
  termsText: z.string().nullable().optional(),
  socialLinks: z.array(socialLinkSchema),
  popupFrequencyDays: z.number().int().positive().optional(),
  consentText: z.string().min(1),
});

export const adminCampaignsRouter = Router();

adminCampaignsRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const campaigns = await listCampaigns();
    res.json({ campaigns });
  }),
);

adminCampaignsRouter.get(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const campaign = await getCampaignById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json({ campaign });
  }),
);

adminCampaignsRouter.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = campaignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const campaign = await createCampaign(parsed.data);
    res.status(201).json({ campaign });
  }),
);

adminCampaignsRouter.put(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = campaignSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const campaign = await updateCampaign(req.params.id, parsed.data);
      res.json({ campaign });
    } catch {
      res.status(404).json({ error: "Campaign not found" });
    }
  }),
);

adminCampaignsRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      await deleteCampaign(req.params.id);
      res.status(204).send();
    } catch {
      res.status(404).json({ error: "Campaign not found" });
    }
  }),
);
