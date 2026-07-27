import "dotenv/config";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";

const port = Number(process.env.PORT) || 4000;

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
  const app = createApp();
  app.listen(port, () => {
    console.log(`Naya Glows backend listening on port ${port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server — database never became reachable:", err);
  process.exit(1);
});
