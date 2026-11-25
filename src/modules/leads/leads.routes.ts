import { Router } from "express";
import { z } from "zod";
import { createLead, listLeads, exportLeadsCsv } from "./leads.service";
import { requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../lib/appError";

const leadSchema = z.object({
  campaignId: z.string().min(1),
  fullName: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1),
  email: z.string().email().optional(),
  socialHandle: z.string().optional(),
  consentGiven: z.boolean(),
});

export const leadsRouter = Router();

leadsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = leadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    try {
      const lead = await createLead(parsed.data);
      res.status(201).json({ lead });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

export const adminLeadsRouter = Router();

adminLeadsRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const leads = await listLeads();
    res.json({ leads });
  }),
);

adminLeadsRouter.get(
  "/export.csv",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const csv = await exportLeadsCsv();
    res.setHeader("content-type", "text/csv");
    res.setHeader("content-disposition", 'attachment; filename="leads.csv"');
    res.send(csv);
  }),
);
