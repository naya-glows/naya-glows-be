import rateLimit from "express-rate-limit";

// Admin password login (auth.routes.ts's /login) — the one endpoint where a
// correct guess is an outright account takeover, and bcrypt's own slowness
// is the only thing currently standing between an attacker and unlimited
// guesses. Keyed on IP (see app.ts's `trust proxy`), not email, since the
// account is unenumerable by email alone and there's only ever one admin
// account in practice.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in a few minutes." },
});

// OTP-sending endpoints (signup + login OTP request) — each send costs a
// real Resend email and a per-*email* cooldown already exists
// (auth.service.ts's OTP_RESEND_COOLDOWN_MS), but that does nothing against
// one source spamming many *different* addresses. This caps how many OTP
// emails one IP can trigger at all, independent of which address they
// target.
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification codes requested. Please try again in a few minutes." },
});
