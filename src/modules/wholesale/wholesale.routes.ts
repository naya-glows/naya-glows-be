import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin } from "../../middleware/auth";
import { sendMail, getAdminNotificationEmail } from "../../lib/mailer";
import { wholesaleInquiryAdminNotification } from "../../lib/emailTemplates";

const createSchema = z.object({
  businessName: z.string().min(1),
  contactName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().optional(),
});

export const wholesaleRouter = Router();

wholesaleRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const inquiry = await prisma.wholesaleInquiry.create({ data: parsed.data });

    await sendMail({
      to: getAdminNotificationEmail(),
      subject: "New wholesale inquiry",
      html: wholesaleInquiryAdminNotification(inquiry),
    });

    res.status(201).json({ inquiry });
  }),
);

export const adminWholesaleRouter = Router();

adminWholesaleRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const inquiries = await prisma.wholesaleInquiry.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ inquiries });
  }),
);
