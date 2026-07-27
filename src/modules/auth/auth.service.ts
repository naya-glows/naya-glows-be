import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { signToken } from "../../lib/jwt";
import { currencyForCountry } from "../../lib/currency";
import { AppError } from "../../lib/appError";

export async function registerUser(input: {
  email: string;
  password: string;
  name: string;
  country?: string;
  referralCode?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError("An account with this email already exists");

  let referredByCodeId: string | undefined;
  if (input.referralCode) {
    const code = await prisma.referralCode.findUnique({
      where: { code: input.referralCode.trim().toUpperCase() },
    });
    if (!code) throw new AppError("That referral code isn't valid");
    referredByCodeId = code.id;
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      country: input.country,
      currency: currencyForCountry(input.country),
      referredByCodeId,
    },
  });

  const token = signToken({ userId: user.id, role: user.role });
  return { user, token };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError("Invalid email or password");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError("Invalid email or password");

  const token = signToken({ userId: user.id, role: user.role });
  return { user, token };
}

export function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  country: string | null;
  currency: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    country: user.country,
    currency: user.currency,
    createdAt: user.createdAt,
  };
}
