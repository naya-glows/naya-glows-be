import { prisma } from "../../lib/prisma";

export const DEFAULT_USD_TO_NGN_RATE = 1600;
// "Subscription A" — the standing repeat-purchase discount (see
// ProductSubscription). Kept under its original key/constant name for
// backward compatibility with rows already in the DB.
export const DEFAULT_SUBSCRIPTION_DISCOUNT_PERCENT = 15;

// "Subscription B" — the prepaid 3/6/12-month plan (see SubscriptionPlan).
// Longer commitment = bigger discount, admin-adjustable per tier.
export const DEFAULT_SUBSCRIPTION_B_3_MONTH_PERCENT = 10;
export const DEFAULT_SUBSCRIPTION_B_6_MONTH_PERCENT = 15;
export const DEFAULT_SUBSCRIPTION_B_12_MONTH_PERCENT = 20;
export type FulfillmentMode = "immediate" | "recurring";
export const DEFAULT_SUBSCRIPTION_B_FULFILLMENT_MODE: FulfillmentMode = "immediate";

export const SETTINGS_KEYS = {
  usdToNgnRate: "usdToNgnRate",
  subscriptionDiscountPercent: "subscriptionDiscountPercent",
  subscriptionB3MonthPercent: "subscriptionB3MonthPercent",
  subscriptionB6MonthPercent: "subscriptionB6MonthPercent",
  subscriptionB12MonthPercent: "subscriptionB12MonthPercent",
  subscriptionBFulfillmentMode: "subscriptionBFulfillmentMode",
} as const;

export async function getUsdToNgnRate(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: SETTINGS_KEYS.usdToNgnRate } });
  const fromDb = row ? Number(row.value) : NaN;
  if (Number.isFinite(fromDb) && fromDb > 0) return fromDb;

  const fromEnv = Number(process.env.USD_TO_NGN_RATE);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_USD_TO_NGN_RATE;
}

export async function getSubscriptionDiscountPercent(): Promise<number> {
  const row = await prisma.setting.findUnique({
    where: { key: SETTINGS_KEYS.subscriptionDiscountPercent },
  });
  const fromDb = row ? Number(row.value) : NaN;
  if (Number.isFinite(fromDb) && fromDb >= 0 && fromDb < 100) return fromDb;
  return DEFAULT_SUBSCRIPTION_DISCOUNT_PERCENT;
}

async function getPercentSetting(key: string, fallback: number): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key } });
  const fromDb = row ? Number(row.value) : NaN;
  return Number.isFinite(fromDb) && fromDb >= 0 && fromDb < 100 ? fromDb : fallback;
}

export function getSubscriptionBDiscountPercent(term: "THREE_MONTH" | "SIX_MONTH" | "TWELVE_MONTH") {
  switch (term) {
    case "THREE_MONTH":
      return getPercentSetting(SETTINGS_KEYS.subscriptionB3MonthPercent, DEFAULT_SUBSCRIPTION_B_3_MONTH_PERCENT);
    case "SIX_MONTH":
      return getPercentSetting(SETTINGS_KEYS.subscriptionB6MonthPercent, DEFAULT_SUBSCRIPTION_B_6_MONTH_PERCENT);
    case "TWELVE_MONTH":
      return getPercentSetting(SETTINGS_KEYS.subscriptionB12MonthPercent, DEFAULT_SUBSCRIPTION_B_12_MONTH_PERCENT);
  }
}

export async function getSubscriptionBFulfillmentMode(): Promise<FulfillmentMode> {
  const row = await prisma.setting.findUnique({
    where: { key: SETTINGS_KEYS.subscriptionBFulfillmentMode },
  });
  return row?.value === "recurring" ? "recurring" : DEFAULT_SUBSCRIPTION_B_FULFILLMENT_MODE;
}

export async function getPublicSettings() {
  const [
    usdToNgnRate,
    subscriptionDiscountPercent,
    subscriptionB3MonthPercent,
    subscriptionB6MonthPercent,
    subscriptionB12MonthPercent,
    subscriptionBFulfillmentMode,
  ] = await Promise.all([
    getUsdToNgnRate(),
    getSubscriptionDiscountPercent(),
    getSubscriptionBDiscountPercent("THREE_MONTH"),
    getSubscriptionBDiscountPercent("SIX_MONTH"),
    getSubscriptionBDiscountPercent("TWELVE_MONTH"),
    getSubscriptionBFulfillmentMode(),
  ]);
  return {
    usdToNgnRate,
    subscriptionDiscountPercent,
    subscriptionB3MonthPercent,
    subscriptionB6MonthPercent,
    subscriptionB12MonthPercent,
    subscriptionBFulfillmentMode,
  };
}

export async function listAllSettings() {
  return getPublicSettings();
}

export async function upsertSetting(key: string, value: string) {
  return prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
