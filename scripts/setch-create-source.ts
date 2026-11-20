import "dotenv/config";

// One-off: creates the Setch catalog source for this site. Run this ONCE
// (`npx tsx scripts/setch-create-source.ts`) after setting SETCH_TOKEN in
// .env — it prints the new source's id, which you then set as
// SETCH_SOURCE_ID (.env locally, and your hosting provider's environment
// settings for production). Running it again creates a second, unwanted
// source, so don't re-run this once you have an id.
async function main() {
  const token = process.env.SETCH_TOKEN;
  if (!token) {
    throw new Error("SETCH_TOKEN is not set — check backend/.env");
  }

  const res = await fetch("https://www.usesetch.xyz/api/catalog/sources/", {
    method: "POST",
    headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      site_key: "site_1b587e16b183",
      name: "NayaGlows catalog",
      source_type: "api",
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`Failed (${res.status}):`, body);
    process.exit(1);
  }

  console.log("Created catalog source. Set this as SETCH_SOURCE_ID:");
  console.log(body.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
