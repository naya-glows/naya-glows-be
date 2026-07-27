import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { signToken } from "../../lib/jwt";
import { currencyForCountry } from "../../lib/currency";
import { AppError } from "../../lib/appError";

export async function registerInfluencer(input: {
  email: string;
  password: string;
  name: string;
  platform?: string;
  socialHandle?: string;
  bio?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError("An account with this email already exists");

  const passwordHash = await bcrypt.hash(input.password, 10);

  // A User row + its Influencer profile always exist together — created in
  // one transaction so we never end up with one without the other.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
        role: "INFLUENCER",
        currency: currencyForCountry(undefined),
      },
    });
    await tx.influencer.create({
      data: {
        userId: created.id,
        platform: input.platform,
        socialHandle: input.socialHandle,
        bio: input.bio,
      },
    });
    return created;
  });

  const token = signToken({ userId: user.id, role: user.role });
  return { user, token };
}

function generateCandidateCode(): string {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X");
  return `GLOW${suffix}`;
}

export async function getInfluencerByUserId(userId: string) {
  return prisma.influencer.findUnique({
    where: { userId },
    include: { user: { select: { name: true, email: true } } },
  });
}

export async function generateReferralCode(userId: string) {
  const influencer = await prisma.influencer.findUnique({ where: { userId } });
  if (!influencer) throw new AppError("Influencer profile not found");

  // Collisions are astronomically unlikely (4 letters + 4 base36 chars) but
  // retry a few times rather than trusting that entirely.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCandidateCode();
    const existing = await prisma.referralCode.findUnique({ where: { code } });
    if (!existing) {
      return prisma.referralCode.create({ data: { code, influencerId: influencer.id } });
    }
  }
  throw new AppError("Couldn't generate a unique referral code — please try again");
}

export async function listOwnReferralCodes(userId: string) {
  const influencer = await prisma.influencer.findUnique({ where: { userId } });
  if (!influencer) throw new AppError("Influencer profile not found");

  const codes = await prisma.referralCode.findMany({
    where: { influencerId: influencer.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { referredUsers: true } } },
  });

  return codes.map((c) => ({
    id: c.id,
    code: c.code,
    createdAt: c.createdAt,
    signupCount: c._count.referredUsers,
  }));
}

export async function listAllInfluencersForAdmin() {
  const influencers = await prisma.influencer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true, createdAt: true } },
      referralCodes: {
        include: { _count: { select: { referredUsers: true } } },
      },
    },
  });

  return influencers.map((inf) => ({
    id: inf.id,
    name: inf.user.name,
    email: inf.user.email,
    platform: inf.platform,
    socialHandle: inf.socialHandle,
    bio: inf.bio,
    createdAt: inf.user.createdAt,
    codes: inf.referralCodes.map((c) => ({
      code: c.code,
      signupCount: c._count.referredUsers,
    })),
    totalSignups: inf.referralCodes.reduce((sum, c) => sum + c._count.referredUsers, 0),
  }));
}
