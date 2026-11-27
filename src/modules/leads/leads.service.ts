import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/appError";
import { sendMail } from "../../lib/mailer";
import { leadRewardCodeEmail } from "../../lib/emailTemplates";

function generateCandidateCode(): string {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X");
  return `WIN${suffix}`;
}

export type LeadInput = {
  campaignId: string;
  fullName: string;
  phone: string;
  address: string;
  email?: string;
  socialHandle?: string;
  consentGiven: boolean;
};

// Captures a spin-to-win lead and issues its one-time, expiring reward
// code in the same call — same "retry a few times on collision" shape as
// createProductSubscriptionsForOrder's SAVE codes.
export async function createLead(input: LeadInput) {
  const campaign = await prisma.campaign.findUnique({ where: { id: input.campaignId } });
  if (!campaign) throw new AppError("This campaign isn't available.");

  let code: string | null = null;
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const candidate = generateCandidateCode();
    const clash = await prisma.lead.findUnique({ where: { rewardCode: candidate } });
    if (!clash) code = candidate;
  }
  if (!code) throw new AppError("Couldn't generate a reward code — please try again.");

  const rewardExpiresAt = new Date();
  rewardExpiresAt.setDate(rewardExpiresAt.getDate() + campaign.codeValidDays);

  const lead = await prisma.lead.create({
    data: {
      campaignId: campaign.id,
      fullName: input.fullName,
      phone: input.phone,
      address: input.address,
      email: input.email,
      socialHandle: input.socialHandle,
      consentGiven: input.consentGiven,
      rewardValueNgn: campaign.rewardValueNgn,
      rewardCode: code,
      rewardExpiresAt,
    },
  });

  // Email is optional on this form — the code is always shown on screen
  // regardless, so a missing address (or a failed send) never blocks the
  // visitor from having their code. Fire-and-forget, same shape as every
  // other best-effort confirmation email in this codebase.
  if (lead.email) {
    sendMail({
      to: lead.email,
      subject: "Your Naya Glows reward code",
      html: leadRewardCodeEmail({
        name: lead.fullName,
        rewardValueNgn: lead.rewardValueNgn,
        rewardCode: lead.rewardCode,
        expiresAt: rewardExpiresAt.toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" }),
      }),
    }).catch((err) => console.error("[leads] Failed to send reward code email:", err));
  }

  return lead;
}

export function listLeads() {
  return prisma.lead.findMany({
    include: { campaign: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function exportLeadsCsv(): Promise<string> {
  const leads = await listLeads();
  const header = [
    "Date",
    "Campaign",
    "Full Name",
    "Phone",
    "Address",
    "Email",
    "Social Handle",
    "Reward",
    "Reward Code",
    "Redeemed",
    "Consent",
  ];
  const rows = leads.map((l) => [
    l.createdAt.toISOString(),
    l.campaign.name,
    l.fullName,
    l.phone,
    l.address,
    l.email ?? "",
    l.socialHandle ?? "",
    `NGN ${l.rewardValueNgn}`,
    l.rewardCode,
    l.rewardRedeemed ? "Yes" : "No",
    l.consentGiven ? "Yes" : "No",
  ]);
  return [header, ...rows].map((row) => row.map((cell) => csvEscape(String(cell))).join(",")).join("\n");
}
