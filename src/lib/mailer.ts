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
    // Many PaaS hosts (Railway included) throttle or don't reliably route
    // outbound SMTP ports, which otherwise hangs on nodemailer's ~2min
    // default timeout per attempt — with pool:false and no cap here, a
    // single unreachable host turns a 50-recipient campaign into ~100
    // minutes of silent hanging (see sendMail's error handling below for
    // why that failure was also invisible). Fail fast instead.
    pool: true,
    maxConnections: 3,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
  return transport;
}

// Degrades gracefully when SMTP isn't configured — logs instead of
// throwing, same "hardcoded/graceful default" philosophy used everywhere
// else in this project for unconfigured external dependencies. Returns
// whether the send actually succeeded (rather than swallowing failures
// silently) so callers sending to multiple recipients — e.g. email
// campaigns — can report real delivery counts instead of a blind "sent".
export async function sendMail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const t = getTransport();
  if (!t) {
    console.log(`[mailer] SMTP not configured — skipped "${opts.subject}" to ${opts.to}`);
    return false;
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || "Naya Glows <no-reply@nayaglows.com>",
      ...opts,
    });
    return true;
  } catch (err) {
    console.error(`[mailer] Failed to send email to ${opts.to}:`, err);
    return false;
  }
}

export function getAdminNotificationEmail(): string {
  return process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SEED_ADMIN_EMAIL || "admin@nayaglows.com";
}
