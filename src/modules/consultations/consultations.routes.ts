import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin } from "../../middleware/auth";
import { sendMail, getAdminNotificationEmail } from "../../lib/mailer";
import {
  consultationReceivedEmail,
  consultationAdminNotification,
} from "../../lib/emailTemplates";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  skinConcern: z.string().min(1),
  preferredDate: z.string().optional(),
  message: z.string().optional(),
});

export const consultationsRouter = Router();

consultationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const request = await prisma.consultationRequest.create({
      data: {
        ...parsed.data,
        preferredDate: parsed.data.preferredDate ? new Date(parsed.data.preferredDate) : null,
      },
    });

    await sendMail({
      to: request.email,
      subject: "We've received your consultation request",
      html: consultationReceivedEmail(request),
    });
    await sendMail({
      to: getAdminNotificationEmail(),
      subject: "New consultation request",
      html: consultationAdminNotification(request),
    });

    res.status(201).json({ request });
  }),
);

export const adminConsultationsRouter = Router();

adminConsultationsRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const requests = await prisma.consultationRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ requests });
  }),
);
