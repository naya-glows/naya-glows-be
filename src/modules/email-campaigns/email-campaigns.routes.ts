import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin } from "../../middleware/auth";
import { sendMail } from "../../lib/mailer";
import { wrapper } from "../../lib/emailTemplates";

export const adminEmailCampaignsRouter = Router();

adminEmailCampaignsRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const campaigns = await prisma.emailCampaign.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ campaigns });
  }),
);

const sendSchema = z.object({
  subject: z.string().min(1),
  message: z.string().min(1),
  // Cloudinary URLs from the same /uploads endpoint products use — never
  // raw HTML/attachments, so there's still no way to send a broken email.
  imageUrls: z.array(z.string().url()).max(6).optional(),
});

adminEmailCampaignsRouter.post(
  "/send",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const subscribers = await prisma.newsletterSubscriber.findMany({ select: { email: true } });
    const imagesHtml = (parsed.data.imageUrls ?? [])
      .map(
        (url) =>
          `<img src="${url}" alt="" style="width:100%; max-width:456px; border-radius:12px; margin-bottom:16px; display:block;" />`,
      )
      .join("");
    const html = wrapper(
      parsed.data.subject,
      `${imagesHtml}<p>${parsed.data.message.replace(/\n/g, "<br/>")}</p>`,
    );

    // Sequential, not Promise.all — keeps this from hammering the SMTP
    // provider with a burst of concurrent connections on larger lists.
    for (const subscriber of subscribers) {
      await sendMail({ to: subscriber.email, subject: parsed.data.subject, html });
    }

    const campaign = await prisma.emailCampaign.create({
      data: {
        subject: parsed.data.subject,
        html,
        recipientCount: subscribers.length,
      },
    });

    res.status(201).json({ campaign });
  }),
);
