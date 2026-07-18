import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin } from "../../middleware/auth";
import { getPublicSettings, listAllSettings, upsertSetting, SETTINGS_KEYS } from "./settings.service";

export const settingsRouter = Router();

settingsRouter.get(
  "/public",
  asyncHandler(async (_req, res) => {
    const settings = await getPublicSettings();
    res.json({ settings });
  }),
);

export const adminSettingsRouter = Router();

adminSettingsRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const settings = await listAllSettings();
    res.json({ settings });
  }),
);

const validKeys = Object.values(SETTINGS_KEYS) as string[];
const updateSchema = z.object({ value: z.union([z.string(), z.number()]) });

adminSettingsRouter.put(
  "/:key",
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!validKeys.includes(req.params.key)) {
      return res.status(400).json({ error: "Unknown setting key" });
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    await upsertSetting(req.params.key, String(parsed.data.value));
    const settings = await listAllSettings();
    res.json({ settings });
  }),
);
