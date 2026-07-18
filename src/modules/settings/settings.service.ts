import { prisma } from "../../lib/prisma";

export const DEFAULT_USD_TO_NGN_RATE = 1600;
export const DEFAULT_SUBSCRIPTION_DISCOUNT_PERCENT = 15;

export const SETTINGS_KEYS = {
  usdToNgnRate: "usdToNgnRate",
  subscriptionDiscountPercent: "subscriptionDiscountPercent",
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

export async function getPublicSettings() {
  const [usdToNgnRate, subscriptionDiscountPercent] = await Promise.all([
    getUsdToNgnRate(),
    getSubscriptionDiscountPercent(),
  ]);
  return { usdToNgnRate, subscriptionDiscountPercent };
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
