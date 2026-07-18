import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin } from "../../middleware/auth";
import { sendMail, getAdminNotificationEmail } from "../../lib/mailer";
import { contactMessageAdminNotification } from "../../lib/emailTemplates";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  subject: z.string().optional(),
  message: z.string().min(1),
});

export const contactRouter = Router();

contactRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const contactMessage = await prisma.contactMessage.create({ data: parsed.data });

    await sendMail({
      to: getAdminNotificationEmail(),
      subject: "New contact message",
      html: contactMessageAdminNotification(contactMessage),
    });

    res.status(201).json({ contactMessage });
  }),
);

export const adminContactRouter = Router();

adminContactRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ messages });
  }),
);
