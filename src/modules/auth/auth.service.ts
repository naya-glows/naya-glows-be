import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { signToken } from "../../lib/jwt";
import { currencyForCountry } from "../../lib/currency";
import { AppError } from "../../lib/appError";
import { sendMail } from "../../lib/mailer";
import { signupOtpEmail } from "../../lib/emailTemplates";

const SIGNUP_OTP_PURPOSE = "SIGNUP";
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Step 1 of signup: emails a 6-digit code and stashes it against the email,
// but creates nothing yet — the account itself is only created once that
// code comes back correct in registerUser below.
export async function requestSignupOtp(email: string) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new AppError("An account with this email already exists");

  const existingOtp = await prisma.emailOtp.findUnique({
    where: { email_purpose: { email, purpose: SIGNUP_OTP_PURPOSE } },
  });
  if (existingOtp && Date.now() - existingOtp.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    throw new AppError("Please wait a moment before requesting another code.");
  }

  const code = generateOtpCode();
  await prisma.emailOtp.upsert({
    where: { email_purpose: { email, purpose: SIGNUP_OTP_PURPOSE } },
    create: { email, purpose: SIGNUP_OTP_PURPOSE, code, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    update: { code, attempts: 0, expiresAt: new Date(Date.now() + OTP_TTL_MS), createdAt: new Date() },
  });

  await sendMail({
    to: email,
    subject: "Your Naya Glows verification code",
    html: signupOtpEmail(code),
  });
}

async function verifyAndConsumeSignupOtp(email: string, code: string) {
  const row = await prisma.emailOtp.findUnique({
    where: { email_purpose: { email, purpose: SIGNUP_OTP_PURPOSE } },
  });
  if (!row) throw new AppError("Please request a new verification code.");

  if (row.expiresAt < new Date()) {
    await prisma.emailOtp.delete({ where: { id: row.id } });
    throw new AppError("This code has expired. Please request a new one.");
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.emailOtp.delete({ where: { id: row.id } });
    throw new AppError("Too many incorrect attempts. Please request a new code.");
  }
  if (row.code !== code) {
    await prisma.emailOtp.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    throw new AppError("Incorrect code. Please try again.");
  }

  await prisma.emailOtp.delete({ where: { id: row.id } });
}

export async function registerUser(input: {
  email: string;
  password: string;
  name: string;
  country?: string;
  referralCode?: string;
  otpCode: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError("An account with this email already exists");

  await verifyAndConsumeSignupOtp(input.email, input.otpCode);

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
