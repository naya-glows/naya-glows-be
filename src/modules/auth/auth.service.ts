import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { signToken } from "../../lib/jwt";
import { currencyForCountry } from "../../lib/currency";
import { AppError } from "../../lib/appError";
import { sendMail } from "../../lib/mailer";
import { signupOtpEmail, passwordResetOtpEmail, welcomeEmail } from "../../lib/emailTemplates";

const SIGNUP_OTP_PURPOSE = "SIGNUP";
const RESET_OTP_PURPOSE = "RESET_PASSWORD";
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Shared by both signup verification and password-reset codes — one row
// per (email, purpose), a new request overwrites the previous code.
async function createAndSendOtp(email: string, purpose: string, subject: string, html: (code: string) => string) {
  const existingOtp = await prisma.emailOtp.findUnique({
    where: { email_purpose: { email, purpose } },
  });
  if (existingOtp && Date.now() - existingOtp.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    throw new AppError("Please wait a moment before requesting another code.");
  }

  const code = generateOtpCode();
  await prisma.emailOtp.upsert({
    where: { email_purpose: { email, purpose } },
    create: { email, purpose, code, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    update: { code, attempts: 0, expiresAt: new Date(Date.now() + OTP_TTL_MS), createdAt: new Date() },
  });

  const sent = await sendMail({ to: email, subject, html: html(code) });
  if (!sent) {
    throw new AppError("Couldn't send the verification code. Please try again in a moment.");
  }
}

async function verifyAndConsumeOtp(email: string, purpose: string, code: string) {
  const row = await prisma.emailOtp.findUnique({
    where: { email_purpose: { email, purpose } },
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

// Step 1 of signup: emails a 6-digit code and stashes it against the email,
// but creates nothing yet — the account itself is only created once that
// code comes back correct in registerUser below.
export async function requestSignupOtp(email: string) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new AppError("An account with this email already exists");

  await createAndSendOtp(email, SIGNUP_OTP_PURPOSE, "Your Naya Glows verification code", signupOtpEmail);
}

// Deliberately does NOT reveal whether the email has an account — always
// "succeeds" from the caller's perspective; if there's no account, requestPasswordReset
// below just skips sending anything.
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  await createAndSendOtp(
    email,
    RESET_OTP_PURPOSE,
    "Reset your Naya Glows password",
    passwordResetOtpEmail,
  );
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError("Incorrect code. Please try again.");

  await verifyAndConsumeOtp(email, RESET_OTP_PURPOSE, code);

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
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

  await verifyAndConsumeOtp(input.email, SIGNUP_OTP_PURPOSE, input.otpCode);

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

  // Fire-and-forget: a welcome email failing to send shouldn't fail the
  // signup itself, the account is already created at this point.
  sendMail({
    to: user.email,
    subject: "Welcome to Naya Glows",
    html: welcomeEmail(user.name),
  }).catch((err) => console.error("[auth] Failed to send welcome email:", err));

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

export async function updateProfile(
  userId: string,
  input: { name?: string; email?: string; country?: string },
) {
  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing && existing.id !== userId) {
      throw new AppError("That email is already in use by another account");
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      email: input.email,
      country: input.country,
      currency: input.country ? currencyForCountry(input.country) : undefined,
    },
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found");

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new AppError("Current password is incorrect");

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
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
