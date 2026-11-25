import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../lib/appError";
import { requireAdmin } from "../../middleware/auth";
import { sendMail, getAdminNotificationEmail } from "../../lib/mailer";
import { wholesaleInquiryAdminNotification } from "../../lib/emailTemplates";
import {
  WHITE_LABEL_CONSULTATION_FEE_NGN,
  getWholesaleInquiryById,
  initiateWhiteLabelPayment,
  verifyWhiteLabelPayment,
} from "./wholesale.service";

const createSchema = z.object({
  businessName: z.string().min(1),
  contactName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().optional(),
  type: z.enum(["WHOLESALE", "CORPORATE_GIFTING", "WHITE_LABEL"]).optional(),
  estimatedQuantity: z.string().optional(),
  budget: z.string().optional(),
  deadline: z.string().datetime().optional(),
});

export const wholesaleRouter = Router();

wholesaleRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const { deadline, type, ...rest } = parsed.data;
    const inquiry = await prisma.wholesaleInquiry.create({
      data: {
        ...rest,
        type: type ?? "WHOLESALE",
        deadline: deadline ? new Date(deadline) : undefined,
        feeNgn: type === "WHITE_LABEL" ? WHITE_LABEL_CONSULTATION_FEE_NGN : undefined,
      },
    });

    // Fire-and-forget — the inquiry is already saved above.
    sendMail({
      to: getAdminNotificationEmail(),
      subject: "New wholesale inquiry",
      html: wholesaleInquiryAdminNotification(inquiry),
    }).catch((err) => console.error("[wholesale] Failed to send admin notification email:", err));

    res.status(201).json({ inquiry });
  }),
);

wholesaleRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const inquiry = await getWholesaleInquiryById(req.params.id);
    if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });
    res.json({ inquiry });
  }),
);

wholesaleRouter.post(
  "/:id/pay",
  asyncHandler(async (req, res) => {
    const frontendOrigin = process.env.CORS_ORIGIN!.split(",")[0].trim();
    try {
      const result = await initiateWhiteLabelPayment(
        req.params.id,
        `${frontendOrigin}/white-label/verify?inquiryId=${encodeURIComponent(req.params.id)}`,
      );
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }),
);

wholesaleRouter.get(
  "/:id/verify",
  asyncHandler(async (req, res) => {
    const reference = String(req.query.reference || "");
    if (!reference) return res.status(400).json({ error: "Missing reference" });
    try {
      const inquiry = await verifyWhiteLabelPayment(req.params.id, reference);
      res.json({ inquiry });
    } catch (err) {
      if (err instanceof AppError) return res.status(400).json({ error: err.message });
      throw err;
    }
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
