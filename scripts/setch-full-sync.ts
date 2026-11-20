import "dotenv/config";
import { syncAllProductsToSetch } from "../src/lib/setch";

// First-import full catalog push — run once after SETCH_SOURCE_ID is set
// (`npx tsx scripts/setch-full-sync.ts`). The same sync also runs nightly
// from the cron job (api/cron/daily.ts) as a safety net, so this is safe
// to re-run any time too.
async function main() {
  const result = await syncAllProductsToSetch();
  console.log(`Pushed ${result.pushed} product(s) to Setch.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
