import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../lib/jwt";
import { prisma } from "../lib/prisma";

export type AuthedRequest = Request & { auth?: JwtPayload };

// Verifies both the JWT itself AND that the account it names still exists.
// A token stays cryptographically valid even after its user row is gone
// (a DB reset during development, or an admin deleting an account) — without
// the existence check, any route that uses req.auth.userId to write a
// related row (e.g. cart.service.ts's Cart upsert) hits a foreign-key
// violation instead of a clean "please sign in again", which is exactly
// what a stale post-reset session did to /cart.
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true } });
    if (!user) {
      return res.status(401).json({ error: "This account no longer exists — please sign in again." });
    }
  } catch (err) {
    return next(err);
  }

  req.auth = payload;
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.auth?.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
}

export function requireInfluencer(req: AuthedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.auth?.role !== "INFLUENCER") {
      return res.status(403).json({ error: "Influencer access required" });
    }
    next();
  });
}

// Attaches req.auth when a valid token is present, but never rejects —
// used by routes that support both guest and signed-in flows (e.g. placing
// an order).
export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (token) {
    try {
      req.auth = verifyToken(token);
    } catch {
      // Ignore invalid/expired tokens on optional routes — proceed as guest.
    }
  }
  next();
}
