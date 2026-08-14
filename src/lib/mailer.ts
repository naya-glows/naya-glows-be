import { Resend } from "resend";

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

// Resend is an HTTP API, not SMTP — this is what actually fixed delivery.
// Railway blocks outbound SMTP ports on the Hobby plan (the real cause of
// every ETIMEDOUT/ENETUNREACH nodemailer hit before this), but a plain
// HTTPS POST to Resend's API goes out over the same port 443 every other
// outbound request already uses.
export async function sendMail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const resend = getClient();
  if (!resend) {
    console.log(`[mailer] RESEND_API_KEY not configured — skipped "${opts.subject}" to ${opts.to}`);
    return false;
  }

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Naya Glows <no-reply@nayaglows.skin>",
    ...opts,
  });

  if (error) {
    console.error(`[mailer] Failed to send email to ${opts.to}:`, error);
    return false;
  }
  return true;
}

export function getAdminNotificationEmail(): string {
  return process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SEED_ADMIN_EMAIL || "admin@nayaglows.skin";
}
