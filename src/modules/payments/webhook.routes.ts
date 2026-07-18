import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { verifyPaystackSignature, confirmPaystackPayment } from "./payments.service";

export const paystackWebhookRouter = Router();

// Mounted with express.raw() ahead of the app's global express.json() in
// app.ts — signature verification needs the exact raw bytes Paystack signed.
paystackWebhookRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const signature = req.headers["x-paystack-signature"] as string | undefined;
    const rawBody = req.body as Buffer;

    if (!verifyPaystackSignature(rawBody, signature)) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const event = JSON.parse(rawBody.toString("utf8"));

    if (event.event === "charge.success" && event.data?.reference) {
      await confirmPaystackPayment(event.data.reference);
    }

    res.status(200).json({ received: true });
  }),
);
