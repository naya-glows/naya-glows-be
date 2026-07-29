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
import { adminBudgetRouter } from "./modules/budget/budget.routes";
import { influencersRouter, adminInfluencersRouter } from "./modules/influencers/influencers.routes";
import { cartRouter } from "./modules/cart/cart.routes";
import type { AuthedRequest } from "./middleware/auth";

export function createApp() {
  const app = express();

  // CORS_ORIGIN must be the exact scheme+host(+port) of every frontend that
  // calls this API (comma-separated for more than one, e.g. a production
  // domain plus a Vercel preview URL) — a stray trailing space after a comma
  // or a mismatched http/https or www would silently fail this exact-match
  // check and the browser would block every request. Required, not
  // optional: an early version of this fell back to "*" (allow any origin)
  // when unset, from back before real env vars were configured anywhere —
  // now that every environment (local, Railway) has real values, that
  // fallback was just a live open-CORS hole, not a helpful default.
  if (!process.env.CORS_ORIGIN) {
    throw new Error(
      "CORS_ORIGIN is not set — set it to your frontend's exact URL(s), comma-separated, before starting the server.",
    );
  }
  const allowedOrigins = process.env.CORS_ORIGIN.split(",").map((o) => o.trim());

  app.use(
    cors({
      origin: allowedOrigins,
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
  app.use("/admin/budget", adminBudgetRouter);
  app.use("/influencers", influencersRouter);
  app.use("/admin/influencers", adminInfluencersRouter);
  app.use("/cart", cartRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Final safety net: any error forwarded via next(err) (including from
  // asyncHandler-wrapped routes) lands here as a 500 instead of crashing
  // the process. Logs which request/user hit it — the only way to
  // investigate a production error afterwards is this Railway log line,
  // there's no other error tracking wired up.
  const errorHandler: ErrorRequestHandler = (err, req: AuthedRequest, res, _next) => {
    console.error(
      `[error] ${req.method} ${req.originalUrl} — user=${req.auth?.userId ?? "anonymous"} role=${req.auth?.role ?? "none"}`,
      err,
    );
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(errorHandler);

  return app;
}
