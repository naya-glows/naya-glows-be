import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Always cached on `global`, not just outside production — on Vercel a
// warm serverless invocation reuses the same module scope, and caching
// here (rather than relying solely on module-load-once semantics) avoids
// opening a fresh pooled connection per cold start if the runtime ever
// re-evaluates this module within a still-warm container.
export const prisma = global.__prisma ?? new PrismaClient();
global.__prisma = prisma;
