import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import authRoutes from "./modules/auth/auth.routes";
import productsRoutes from "./modules/products/products.routes";
import uploadsRoutes from "./modules/uploads/uploads.routes";
import usersRoutes from "./modules/users/users.routes";
import contentRoutes from "./modules/content/content.routes";
import { ordersRouter, adminOrdersRouter } from "./modules/orders/orders.routes";
import { paymentsRouter } from "./modules/payments/payments.routes";
import { paystackWebhookRouter } from "./modules/payments/webhook.routes";
import { consultationsRouter, adminConsultationsRouter } from "./modules/consultations/consultations.routes";
import { wholesaleRouter, adminWholesaleRouter } from "./modules/wholesale/wholesale.routes";
import { savedProductsRouter } from "./modules/saved-products/saved-products.routes";
import { settingsRouter, adminSettingsRouter } from "./modules/settings/settings.routes";
import { contactRouter, adminContactRouter } from "./modules/contact/contact.routes";
import { newsletterRouter, adminNewsletterRouter } from "./modules/newsletter/newsletter.routes";
import { adminEmailCampaignsRouter } from "./modules/email-campaigns/email-campaigns.routes";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(",") ?? "*",
      credentials: true,
    }),
  );

  // Mounted with a raw body parser AHEAD of the global express.json() below —
  // Paystack's webhook signature is computed over the exact raw bytes sent,
  // so it must never pass through JSON parsing first.
  app.use(
    "/webhooks/paystack",
    express.raw({ type: "application/json" }),
    paystackWebhookRouter,
  );

  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/auth", authRoutes);
  app.use("/products", productsRoutes);
  app.use("/uploads", uploadsRoutes);
  app.use("/admin/users", usersRoutes);
  app.use("/content", contentRoutes);
  app.use("/orders", ordersRouter);
  app.use("/admin/orders", adminOrdersRouter);
  app.use("/payments", paymentsRouter);
  app.use("/consultations", consultationsRouter);
  app.use("/admin/consultations", adminConsultationsRouter);
  app.use("/wholesale-inquiries", wholesaleRouter);
  app.use("/admin/wholesale-inquiries", adminWholesaleRouter);
  app.use("/saved-products", savedProductsRouter);
  app.use("/settings", settingsRouter);
  app.use("/admin/settings", adminSettingsRouter);
  app.use("/contact-messages", contactRouter);
  app.use("/admin/contact-messages", adminContactRouter);
  app.use("/newsletter", newsletterRouter);
  app.use("/admin/newsletter-subscribers", adminNewsletterRouter);
  app.use("/admin/email-campaigns", adminEmailCampaignsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Final safety net: any error forwarded via next(err) (including from
  // asyncHandler-wrapped routes) lands here as a 500 instead of crashing
  // the process.
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(errorHandler);

  return app;
}
