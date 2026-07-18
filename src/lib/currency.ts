// Minimal country -> currency mapping used at signup to set a sensible
// default. Live FX conversion / a fuller mapping table is a later phase.
const COUNTRY_CURRENCY: Record<string, string> = {
  NG: "NGN",
  US: "USD",
  GB: "GBP",
  CA: "CAD",
  GH: "GHS",
  KE: "KES",
  ZA: "ZAR",
  EU: "EUR",
};

export function currencyForCountry(countryCode?: string | null): string {
  if (!countryCode) return "USD";
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? "USD";
}
