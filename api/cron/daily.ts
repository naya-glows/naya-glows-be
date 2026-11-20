import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "http";
import { syncUsdToNgnRate } from "../../src/jobs/fxRateSync";
import { runAbandonedCartReminders } from "../../src/jobs/cartReminders";
import { runSubscriptionShipments } from "../../src/jobs/subscriptionShipments";
import { reconcileStalePendingOrders } from "../../src/modules/payments/payments.service";

// Single daily cron entry point covering all three background jobs that
// used to run on setInterval timers inside the always-on Railway/Render
// process (see src/index.ts, kept as-is for local dev). Vercel has no
// persistent process to hold those timers, so this is invoked on a
// schedule instead — see vercel.json's `crons`. Combined into one function
// (rather than three separate cron entries) since Vercel's free/Hobby cron
// job-count limits are small and all three jobs already run once daily.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const auth = req.headers["authorization"];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  const results = await Promise.allSettled([
    syncUsdToNgnRate(),
    runAbandonedCartReminders(),
    runSubscriptionShipments(),
    reconcileStalePendingOrders(),
  ]);

  const names = ["fx-rate-sync", "cart-reminders", "subscription-shipments", "reconcile-pending-orders"];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[cron:daily] ${names[i]} failed:`, r.reason);
    }
  });

  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({
      ok: true,
      ran: names.map((name, i) => ({ name, ok: results[i].status === "fulfilled" })),
    }),
  );
}
