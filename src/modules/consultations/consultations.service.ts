import crypto from "crypto";
import { waitUntil } from "@vercel/functions";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/appError";
import { initializeTransaction, verifyTransaction } from "../payments/paystack";
import { sendMail, getAdminNotificationEmail } from "../../lib/mailer";
import {
  consultationReceivedEmail,
  consultationAdminNotification,
} from "../../lib/emailTemplates";

// Business hours from the client's brief: "Monday to Saturday, 10:00 AM –
// 5:00 PM, 30-minute slots." Sunday (0) is closed.
const OPEN_HOUR = 10;
const CLOSE_HOUR = 17;
const SLOT_MINUTES = 30;
const BOOKING_WINDOW_DAYS = 365;

function generateBookingReference(): string {
  return `NG-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export function listActiveConsultationTypes() {
  return prisma.consultationType.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
}

export function listConsultationTypes() {
  return prisma.consultationType.findMany({ orderBy: { sortOrder: "asc" } });
}

export function updateConsultationType(
  slug: string,
  input: Partial<{ name: string; feeNgn: number; durationMinutes: number; isActive: boolean }>,
) {
  return prisma.consultationType.update({ where: { slug }, data: input });
}

export function listConsultationBlocks() {
  return prisma.consultationBlock.findMany({ orderBy: { date: "asc" } });
}

export function createConsultationBlock(input: {
  date: Date;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
}) {
  return prisma.consultationBlock.create({ data: input });
}

export function deleteConsultationBlock(id: string) {
  return prisma.consultationBlock.delete({ where: { id } });
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// Returns the available slot start times ("HH:mm") for one calendar day and
// a given consultation type's duration — closed Sundays, outside the
// rolling 12-month window, fully blocked, or not fitting before closing are
// all excluded; a slot already occupied by another non-cancelled booking
// (checked by actual time overlap, not just an exact-match) is excluded too.
export async function getAvailableSlots(dateStr: string, typeSlug: string) {
  const type = await prisma.consultationType.findUnique({ where: { slug: typeSlug } });
  if (!type || !type.isActive) throw new AppError("That consultation type isn't available.");

  const date = new Date(`${dateStr}T00:00:00Z`);
  const now = new Date();
  const windowEnd = new Date(now.getTime() + BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  if (date < new Date(now.toDateString()) || date > windowEnd) return [];
  if (date.getUTCDay() === 0) return []; // Sunday

  const dayStart = new Date(`${dateStr}T00:00:00Z`);
  const dayEnd = new Date(`${dateStr}T23:59:59Z`);

  const [blocks, bookings] = await Promise.all([
    prisma.consultationBlock.findMany({ where: { date: { gte: dayStart, lte: dayEnd } } }),
    prisma.consultationRequest.findMany({
      where: {
        scheduledDate: { gte: dayStart, lte: dayEnd },
        status: { not: "CANCELLED" },
      },
      select: { scheduledDate: true, durationMinutes: true },
    }),
  ]);

  if (blocks.some((b) => !b.startTime && !b.endTime)) return []; // whole day blocked

  const slots: string[] = [];
  for (let start = OPEN_HOUR * 60; start + type.durationMinutes <= CLOSE_HOUR * 60; start += SLOT_MINUTES) {
    const end = start + type.durationMinutes;

    const blockedByAdmin = blocks.some((b) => {
      if (!b.startTime || !b.endTime) return false;
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);
      return start < bEnd && end > bStart;
    });
    if (blockedByAdmin) continue;

    const overlapsBooking = bookings.some((bk) => {
      if (!bk.scheduledDate || !bk.durationMinutes) return false;
      const bkStartMin = bk.scheduledDate.getUTCHours() * 60 + bk.scheduledDate.getUTCMinutes();
      const bkEndMin = bkStartMin + bk.durationMinutes;
      return start < bkEndMin && end > bkStartMin;
    });
    if (overlapsBooking) continue;

    // Don't offer a slot that's already in the past for today.
    if (dateStr === now.toISOString().slice(0, 10) && start <= now.getUTCHours() * 60 + now.getUTCMinutes()) {
      continue;
    }

    slots.push(minutesToTime(start));
  }
  return slots;
}

export type CreateBookingInput = {
  consultationTypeSlug: string;
  scheduledDate: string; // ISO datetime
  name: string;
  email: string;
  phone?: string;
  skinConcern: string;
  message?: string;
};

export async function createConsultationBooking(input: CreateBookingInput) {
  const type = await prisma.consultationType.findUnique({ where: { slug: input.consultationTypeSlug } });
  if (!type || !type.isActive) throw new AppError("That consultation type isn't available.");

  const scheduledDate = new Date(input.scheduledDate);
  const dateStr = scheduledDate.toISOString().slice(0, 10);
  const timeStr = minutesToTime(scheduledDate.getUTCHours() * 60 + scheduledDate.getUTCMinutes());

  // Re-validate against the live calendar right before booking — the slot
  // list the customer saw may be a few minutes stale.
  const available = await getAvailableSlots(dateStr, input.consultationTypeSlug);
  if (!available.includes(timeStr)) {
    throw new AppError("That time is no longer available. Please pick another slot.");
  }

  let bookingReference = generateBookingReference();
  for (let attempt = 0; attempt < 3; attempt++) {
    const clash = await prisma.consultationRequest.findUnique({ where: { bookingReference } });
    if (!clash) break;
    bookingReference = generateBookingReference();
  }

  const request = await prisma.consultationRequest.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      skinConcern: input.skinConcern,
      message: input.message,
      consultationTypeId: type.id,
      scheduledDate,
      durationMinutes: type.durationMinutes,
      feeNgn: type.feeNgn,
      bookingReference,
    },
    include: { consultationType: true },
  });

  waitUntil(
    sendMail({
      to: request.email,
      subject: "We've received your consultation request",
      html: consultationReceivedEmail(request),
    }).catch((err) => console.error("[consultations] Failed to send confirmation email:", err)),
  );
  waitUntil(
    sendMail({
      to: getAdminNotificationEmail(),
      subject: "New consultation booking",
      html: consultationAdminNotification(request),
    }).catch((err) => console.error("[consultations] Failed to send admin notification email:", err)),
  );

  return request;
}

export async function initiateConsultationPayment(id: string, callbackUrl: string) {
  const request = await prisma.consultationRequest.findUnique({ where: { id } });
  if (!request) throw new AppError("Consultation booking not found");
  if (request.paid) throw new AppError("This booking is already paid.");

  const reference = `naya-consult-${request.id}-${Date.now()}`;
  const { authorization_url: authorizationUrl } = await initializeTransaction({
    email: request.email,
    amountKobo: Math.round(request.feeNgn * 100),
    currency: "NGN",
    reference,
    callbackUrl,
  });

  await prisma.consultationRequest.update({ where: { id }, data: { paymentReference: reference } });
  return { authorizationUrl };
}

export async function verifyConsultationPayment(id: string, reference: string) {
  const request = await prisma.consultationRequest.findUnique({ where: { id } });
  if (!request) throw new AppError("Consultation booking not found");
  if (request.paymentReference !== reference) {
    throw new AppError("This payment reference doesn't match this booking.");
  }
  if (request.paid) return request;

  const result = await verifyTransaction(reference);
  const expectedAmountKobo = Math.round(request.feeNgn * 100);
  const succeeded =
    result.status === "success" && result.amount === expectedAmountKobo && result.currency === "NGN";
  if (!succeeded) throw new AppError("Payment wasn't successful.");

  return prisma.consultationRequest.update({
    where: { id },
    data: { paid: true },
    include: { consultationType: true },
  });
}

export function getConsultationById(id: string) {
  return prisma.consultationRequest.findUnique({ where: { id }, include: { consultationType: true } });
}

export function listConsultations() {
  return prisma.consultationRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { consultationType: true },
  });
}

export function rescheduleConsultation(id: string, scheduledDate: Date) {
  return prisma.consultationRequest.update({ where: { id }, data: { scheduledDate, status: "RESCHEDULED" } });
}

export function cancelConsultation(id: string) {
  return prisma.consultationRequest.update({ where: { id }, data: { status: "CANCELLED" } });
}

// Backs the ICS subscribe-by-URL feed (see calendar.routes.ts) — only
// confirmed, scheduled bookings, paid or not (an unpaid-but-booked slot
// still occupies the admin's time and belongs on the calendar).
export function listScheduledConsultationsForFeed() {
  return prisma.consultationRequest.findMany({
    where: { scheduledDate: { not: null }, status: { not: "CANCELLED" } },
    include: { consultationType: true },
    orderBy: { scheduledDate: "asc" },
  });
}
