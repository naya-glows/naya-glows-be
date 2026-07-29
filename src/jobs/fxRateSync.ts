import { upsertSetting, SETTINGS_KEYS } from "../modules/settings/settings.service";

// Free, keyless, updated daily — no signup required. If this ever needs
// swapping, any endpoint returning `{ rates: { NGN: number } }` for a
// USD base works as a drop-in.
const FX_API_URL = "https://open.er-api.com/v6/latest/USD";

async function fetchLiveUsdToNgnRate(): Promise<number | null> {
  try {
    const res = await fetch(FX_API_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;

    const body = (await res.json()) as { rates?: Record<string, number> };
    const rate = body.rates?.NGN;
    return typeof rate === "number" && rate > 0 ? rate : null;
  } catch (err) {
    console.error("[fx-rate] Failed to fetch live USD->NGN rate:", err);
    return null;
  }
}

// Runs on an interval from index.ts. The admin's manually-set rate (or the
// hardcoded fallback) still works exactly as before — this just keeps the
// Setting row it reads from fresh automatically, so nobody has to remember
// to update it as the real exchange rate moves. A failed fetch (API down,
// network hiccup) leaves the current rate untouched rather than clearing it.
export async function syncUsdToNgnRate() {
  const rate = await fetchLiveUsdToNgnRate();
  if (rate === null) {
    console.warn("[fx-rate] Live rate fetch failed — keeping the current USD->NGN rate.");
    return;
  }

  await upsertSetting(SETTINGS_KEYS.usdToNgnRate, String(Math.round(rate * 100) / 100));
  console.log(`[fx-rate] USD->NGN rate synced to ₦${rate.toFixed(2)}`);
}
