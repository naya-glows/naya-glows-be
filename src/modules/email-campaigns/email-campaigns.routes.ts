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
  audience: z.enum(["subscribers", "allUsers"]).default("subscribers"),
});

adminEmailCampaignsRouter.post(
  "/send",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const recipients =
      parsed.data.audience === "allUsers"
        ? await prisma.user.findMany({ select: { email: true } })
        : await prisma.newsletterSubscriber.findMany({ select: { email: true } });
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
    // sendMail's return is checked (not just awaited-and-ignored) so a
    // provider-side failure — e.g. a connection timeout — is counted and
    // logged per recipient instead of silently reported as "sent".
    let sentCount = 0;
    const failedEmails: string[] = [];
    for (const recipient of recipients) {
      const ok = await sendMail({ to: recipient.email, subject: parsed.data.subject, html });
      if (ok) sentCount += 1;
      else failedEmails.push(recipient.email);
    }
    if (failedEmails.length > 0) {
      console.error(
        `[email-campaigns] "${parsed.data.subject}" failed to send to ${failedEmails.length}/${recipients.length} recipient(s): ${failedEmails.join(", ")}`,
      );
    }

    const campaign = await prisma.emailCampaign.create({
      data: {
        subject: parsed.data.subject,
        html,
        recipientCount: recipients.length,
        audience: parsed.data.audience,
      },
    });

    res.status(201).json({ campaign, sentCount, failedCount: failedEmails.length });
  }),
);
