import { prisma } from "../../lib/prisma";

export type SeasonalSaleInput = {
  slug: string;
  name: string;
  discountPercent: number;
  productSlugs?: string[];
  startDate: Date;
  endDate: Date;
  isActive?: boolean;
  bannerHeadline: string;
  bannerCopy: string;
  bannerImage?: string | null;
};

export function listSales() {
  return prisma.seasonalSale.findMany({ orderBy: { startDate: "desc" } });
}

// "Active" here means both the admin's toggle AND the campaign's own date
// window — a sale the admin forgot to switch off shouldn't keep running
// past its own end date, and one scheduled for later shouldn't show early.
export function listCurrentlyActiveSales() {
  const now = new Date();
  return prisma.seasonalSale.findMany({
    where: { isActive: true, startDate: { lte: now }, endDate: { gte: now } },
    orderBy: { startDate: "desc" },
  });
}

export function getSaleBySlug(slug: string) {
  return prisma.seasonalSale.findUnique({ where: { slug } });
}

export function createSale(input: SeasonalSaleInput) {
  return prisma.seasonalSale.create({
    data: { ...input, productSlugs: input.productSlugs ?? [], bannerImage: input.bannerImage ?? null },
  });
}

export function updateSale(slug: string, input: Partial<SeasonalSaleInput>) {
  return prisma.seasonalSale.update({ where: { slug }, data: input });
}

export function deleteSale(slug: string) {
  return prisma.seasonalSale.delete({ where: { slug } });
}

// Daily-cron safety net — an admin can still manually flip isActive off any
// time, this just catches ones left on past their own end date.
export async function deactivateExpiredSales() {
  const result = await prisma.seasonalSale.updateMany({
    where: { isActive: true, endDate: { lt: new Date() } },
    data: { isActive: false },
  });
  return result.count;
}
