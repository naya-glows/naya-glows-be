import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { buildIcsFeed } from "../../lib/ics";
import { listScheduledConsultationsForFeed } from "./consultations.service";

// Unauthenticated-but-token-gated: Google Calendar's "Add calendar → From
// URL" (and most other calendar apps) do a plain periodic GET with no
// custom headers, so a Bearer/requireAdmin check (as used everywhere else
// admin-only) isn't reachable from there — the token has to live in the
// URL itself. Treat the full URL (with token) as a secret the same way a
// password is; see admin/consultations UI for where it's shown/copied.
export const calendarRouter = Router();

calendarRouter.get(
  "/calendar.ics",
  asyncHandler(async (req, res) => {
    const token = String(req.query.token || "");
    if (!process.env.CALENDAR_FEED_TOKEN || token !== process.env.CALENDAR_FEED_TOKEN) {
      return res.status(401).send("Unauthorized");
    }

    const bookings = await listScheduledConsultationsForFeed();
    const ics = buildIcsFeed(
      "Naya Glows Consultations",
      bookings.map((b) => {
        const start = b.scheduledDate!;
        const durationMinutes = b.durationMinutes ?? b.consultationType?.durationMinutes ?? 30;
        const end = new Date(start.getTime() + durationMinutes * 60_000);
        return {
          uid: `consultation-${b.id}@nayaglows.skin`,
          start,
          end,
          summary: `Consultation: ${b.name}${b.consultationType ? ` (${b.consultationType.name})` : ""}`,
          description: [
            `Phone: ${b.phone ?? "N/A"}`,
            `Email: ${b.email}`,
            `Skin concern: ${b.skinConcern}`,
            `Payment: ${b.paid ? `Paid NGN ${b.feeNgn}` : "Unpaid"}`,
            b.bookingReference ? `Reference: ${b.bookingReference}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        };
      }),
    );

    res.setHeader("content-type", "text/calendar; charset=utf-8");
    res.send(ics);
  }),
);
