import { prisma } from "../../lib/prisma";

export type CampaignInput = {
  name: string;
  isActive?: boolean;
  startDate: string;
  endDate: string;
  popupHeadline: string;
  popupCopy: string;
  popupImage?: string | null;
  ctaText: string;
  landingPath: string;
  rewardValueNgn?: number;
  codeValidDays?: number;
  redemptionRules?: string | null;
  termsText?: string | null;
  socialLinks: { platform: string; url: string }[];
  popupFrequencyDays?: number;
  consentText: string;
};

export function listCampaigns() {
  return prisma.campaign.findMany({ orderBy: { createdAt: "desc" } });
}

export function getCampaignById(id: string) {
  return prisma.campaign.findUnique({ where: { id } });
}

// The one campaign visitors actually see — active, and within its own
// date window (isActive alone isn't enough: an admin may flip a campaign
// on ahead of its start date, or forget to turn an old one off after its
// end date). Assumes at most one such campaign at a time (enforced by
// admin discipline, not the schema — see schema.prisma's own note on this).
export function getActiveCampaign() {
  const now = new Date();
  return prisma.campaign.findFirst({
    where: { isActive: true, startDate: { lte: now }, endDate: { gte: now } },
    orderBy: { createdAt: "desc" },
  });
}

function toDateOrUndefined(value: string | undefined) {
  return value ? new Date(value) : undefined;
}

export async function createCampaign(input: CampaignInput) {
  return prisma.campaign.create({
    data: {
      name: input.name,
      isActive: input.isActive ?? false,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      popupHeadline: input.popupHeadline,
      popupCopy: input.popupCopy,
      popupImage: input.popupImage ?? null,
      ctaText: input.ctaText,
      landingPath: input.landingPath,
      rewardValueNgn: input.rewardValueNgn ?? 1000,
      codeValidDays: input.codeValidDays ?? 14,
      redemptionRules: input.redemptionRules ?? null,
      termsText: input.termsText ?? null,
      socialLinks: input.socialLinks,
      popupFrequencyDays: input.popupFrequencyDays ?? 7,
      consentText: input.consentText,
    },
  });
}

export async function updateCampaign(id: string, input: Partial<CampaignInput>) {
  return prisma.campaign.update({
    where: { id },
    data: {
      name: input.name,
      isActive: input.isActive,
      startDate: toDateOrUndefined(input.startDate),
      endDate: toDateOrUndefined(input.endDate),
      popupHeadline: input.popupHeadline,
      popupCopy: input.popupCopy,
      popupImage: input.popupImage,
      ctaText: input.ctaText,
      landingPath: input.landingPath,
      rewardValueNgn: input.rewardValueNgn,
      codeValidDays: input.codeValidDays,
      redemptionRules: input.redemptionRules,
      termsText: input.termsText,
      socialLinks: input.socialLinks,
      popupFrequencyDays: input.popupFrequencyDays,
      consentText: input.consentText,
    },
  });
}

export async function deleteCampaign(id: string) {
  await prisma.campaign.delete({ where: { id } });
}

// Run from the daily cron, same pattern as sales.service.ts's
// deactivateExpiredSales — an admin who forgets to turn a campaign off
// after its own endDate shouldn't have it keep popping up indefinitely.
export async function deactivateExpiredCampaigns() {
  await prisma.campaign.updateMany({
    where: { isActive: true, endDate: { lt: new Date() } },
    data: { isActive: false },
  });
}
