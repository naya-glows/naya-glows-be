import "dotenv/config";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";
import { runSeed } from "./lib/runSeed";
import { runAbandonedCartReminders } from "./jobs/cartReminders";

const port = Number(process.env.PORT) || 4000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Prisma connects lazily on the first query, so without this, a restart
// that lands before the host's DB networking (e.g. Railway's private
// network) is fully wired up would start accepting traffic and fail the
// first real request instead of failing fast at boot.
async function waitForDatabase(maxAttempts = 10, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.log(
        `Database not reachable yet (attempt ${attempt}/${maxAttempts}) — retrying in ${delayMs}ms…`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function main() {
  await waitForDatabase();

  // Runs on every boot, not just once manually — this is what actually
  // guarantees the admin account and default products exist in production,
  // independent of whatever Start Command Railway's dashboard is configured
  // with (a custom one there would bypass package.json's "start" script
  // entirely, so this can't live only as an `npm run seed` step).
  await runSeed();

  const app = createApp();
  app.listen(port, () => {
    console.log(`Naya Glows backend listening on port ${port}`);
  });

  // No separate cron infra on Railway for this app — a daily in-process
  // interval is sufficient at this scale. Errors inside are caught so a
  // single failed run (e.g. a transient SMTP hiccup) can't crash the server.
  setInterval(() => {
    runAbandonedCartReminders().catch((err) =>
      console.error("[cart-reminders] Run failed:", err),
    );
  }, ONE_DAY_MS);
}

main().catch((err) => {
  console.error("Failed to start server — database never became reachable:", err);
  process.exit(1);
});
