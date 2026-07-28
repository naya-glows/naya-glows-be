import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runSeed } from "../src/lib/runSeed";

// Manual CLI entry point (`npm run seed`) — the actual logic lives in
// runSeed() since the server also calls it on every boot (src/index.ts),
// and that caller must not have its Prisma connection torn down afterward
// the way this standalone script disconnects and exits.
runSeed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
