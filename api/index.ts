import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../src/app";
import { runSeed } from "../src/lib/runSeed";

const app = createApp();

// Idempotent and cheap once warm — only actually hits the DB on a cold
// start of this function instance, not on every request to a warm one.
let seeded: Promise<void> | null = null;
function ensureSeeded() {
  if (!seeded) {
    seeded = runSeed().catch((err) => {
      seeded = null;
      throw err;
    });
  }
  return seeded;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ensureSeeded();
  app(req, res);
}
