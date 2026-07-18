import nodemailer from "nodemailer";

let transport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (transport) return transport;

  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transport;
}

// Degrades gracefully when SMTP isn't configured — logs instead of
// throwing, same "hardcoded/graceful default" philosophy used everywhere
// else in this project for unconfigured external dependencies.
export async function sendMail(opts: { to: string; subject: string; html: string }) {
  const t = getTransport();
  if (!t) {
    console.log(`[mailer] SMTP not configured — skipped "${opts.subject}" to ${opts.to}`);
    return;
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || "Naya Glows <no-reply@nayaglows.com>",
      ...opts,
    });
  } catch (err) {
    console.error("[mailer] Failed to send email:", err);
  }
}

export function getAdminNotificationEmail(): string {
  return process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SEED_ADMIN_EMAIL || "admin@nayaglows.com";
}
