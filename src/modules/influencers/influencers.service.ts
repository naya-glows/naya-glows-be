import { prisma } from "../../lib/prisma";
import { signToken } from "../../lib/jwt";
import { AppError } from "../../lib/appError";

// An influencer is just a signed-in customer with an Influencer profile
// appended and their role bumped — never a separate account. The caller
// must already be authenticated (see the /influencers/upgrade route), so
// this only ever adds a profile to an existing userId.
export async function upgradeToInfluencer(
  userId: string,
  input: {
    codeName: string;
    twitterHandle?: string;
    instagramHandle?: string;
    tiktokHandle?: string;
    bio?: string;
  },
) {
  const existing = await getInfluencerByUserId(userId);
  if (existing) throw new AppError("This account is already part of the influencer program.");

  // Normalized the same way every referral code that gets built from it
  // will read — letters/digits only, uppercased, so "Star Girl!" and
  // "star_girl" don't collide-but-look-different in the codes they produce.
  const codeName = input.codeName.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!codeName) throw new AppError("Please enter a valid influencer code name.");

  const codeNameTaken = await prisma.influencer.findUnique({ where: { codeName } });
  if (codeNameTaken) throw new AppError("That code name is already taken — please choose another.");

  // The Influencer profile and the role bump happen together so we never
  // end up with one without the other.
  const user = await prisma.$transaction(async (tx) => {
    await tx.influencer.create({
      data: {
        userId,
        codeName,
        twitterHandle: input.twitterHandle?.trim() || undefined,
        instagramHandle: input.instagramHandle?.trim() || undefined,
        tiktokHandle: input.tiktokHandle?.trim() || undefined,
        bio: input.bio?.trim() || undefined,
      },
    });
    return tx.user.update({ where: { id: userId }, data: { role: "INFLUENCER" } });
  });

  // A fresh token is required — the caller's existing token still carries
  // the old "CUSTOMER" role claim, which requireInfluencer checks directly
  // without a DB lookup.
  const token = signToken({ userId: user.id, role: user.role });
  return { user, token };
}

// e.g. codeName "STARGIRL" -> "STARGIRL4Z5OA3E2".
function generateCandidateCode(codeName: string): string {
  const suffix = Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, "X");
  return `${codeName}${suffix}`;
}

export async function getInfluencerByUserId(userId: string) {
  return prisma.influencer.findUnique({
    where: { userId },
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  });
}

export async function generateReferralCode(userId: string) {
  const influencer = await prisma.influencer.findUnique({ where: { userId } });
  if (!influencer) throw new AppError("Influencer profile not found");

  // Collisions are astronomically unlikely (codeName + 8 base36 chars) but
  // retry a few times rather than trusting that entirely.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCandidateCode(influencer.codeName);
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
      user: { select: { firstName: true, lastName: true, email: true, createdAt: true } },
      referralCodes: {
        include: { _count: { select: { referredUsers: true } } },
      },
    },
  });

  return influencers.map((inf) => ({
    id: inf.id,
    name: `${inf.user.firstName} ${inf.user.lastName}`,
    email: inf.user.email,
    codeName: inf.codeName,
    twitterHandle: inf.twitterHandle,
    instagramHandle: inf.instagramHandle,
    tiktokHandle: inf.tiktokHandle,
    bio: inf.bio,
    createdAt: inf.user.createdAt,
    codes: inf.referralCodes.map((c) => ({
      code: c.code,
      signupCount: c._count.referredUsers,
    })),
    totalSignups: inf.referralCodes.reduce((sum, c) => sum + c._count.referredUsers, 0),
  }));
}
