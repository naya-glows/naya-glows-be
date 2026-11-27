import { waitUntil } from "@vercel/functions";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/appError";
import { initializeTransaction, verifyTransaction } from "../payments/paystack";
import { sendMail } from "../../lib/mailer";
import { reservationConfirmationEmail } from "../../lib/emailTemplates";

// Fixed per the client's own brief — "remaining balances will be paid on
// Black Friday, November 27, 2026." Hardcoded like GLOW15's constants in
// orders.service.ts for the same reason: there's exactly one campaign today,
// and this is the place to generalize if a second one ever needs its own date.
export const BLACK_FRIDAY_BALANCE_DUE_DATE = new Date("2026-11-27T23:59:59Z");

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ReservationKitInput = {
  slug: string;
  name: string;
  totalPrice: number;
  depositAmount: number;
  publicPrice?: number | null;
  isActive?: boolean;
  sortOrder?: number;
};

export function listActiveReservationKits() {
  return prisma.reservationKit.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export function listReservationKits() {
  return prisma.reservationKit.findMany({ orderBy: { sortOrder: "asc" } });
}

export function createReservationKit(input: ReservationKitInput) {
  return prisma.reservationKit.create({ data: { ...input, publicPrice: input.publicPrice ?? null } });
}

export function updateReservationKit(slug: string, input: Partial<ReservationKitInput>) {
  return prisma.reservationKit.update({ where: { slug }, data: input });
}

export function deleteReservationKit(slug: string) {
  return prisma.reservationKit.delete({ where: { slug } });
}

export function getReservationById(id: string) {
  return prisma.kitReservation.findUnique({ where: { id }, include: { kit: true } });
}

export function listReservations() {
  return prisma.kitReservation.findMany({
    include: { kit: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createReservation(input: {
  kitSlug: string;
  fullName: string;
  email: string;
  phone: string;
}) {
  const kit = await prisma.reservationKit.findUnique({ where: { slug: input.kitSlug } });
  if (!kit || !kit.isActive) throw new AppError("This reservation kit isn't available.");

  const balanceAmount = round2(kit.totalPrice - kit.depositAmount);
  return prisma.kitReservation.create({
    data: {
      kitId: kit.id,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      depositAmount: kit.depositAmount,
      balanceAmount,
      balanceDueDate: BLACK_FRIDAY_BALANCE_DUE_DATE,
    },
    include: { kit: true },
  });
}

// Charges whatever's owed right now — the deposit first, then (once that's
// paid) the balance. A single "pay" entry point rather than two separate
// ones, since what's owed is always unambiguous from the reservation's own
// state.
export async function initiateReservationPayment(id: string, callbackUrl: string) {
  const reservation = await prisma.kitReservation.findUnique({ where: { id }, include: { kit: true } });
  if (!reservation) throw new AppError("Reservation not found");
  if (reservation.status === "CANCELLED") throw new AppError("This reservation has been cancelled.");

  const stage = !reservation.depositPaid ? "deposit" : "balance";
  const amount = stage === "deposit" ? reservation.depositAmount : reservation.balanceAmount;
  if (stage === "balance" && reservation.balancePaid) {
    throw new AppError("This reservation is already fully paid.");
  }

  const reference = `naya-resv-${reservation.id}-${stage}-${Date.now()}`;
  const { authorization_url: authorizationUrl } = await initializeTransaction({
    email: reservation.email,
    amountKobo: Math.round(amount * 100),
    currency: "NGN",
    reference,
    callbackUrl,
  });

  // Stash the reference on the stage currently being paid so verify can
  // confirm it actually matches *this* attempt — set now (PENDING-equivalent)
  // rather than only on success, so a reload/retry always knows what to ask
  // Paystack to verify.
  await prisma.kitReservation.update({
    where: { id },
    data: stage === "deposit" ? { depositReference: reference } : { balanceReference: reference },
  });

  return { authorizationUrl, stage };
}

export async function verifyReservationPayment(id: string, reference: string) {
  const reservation = await prisma.kitReservation.findUnique({ where: { id }, include: { kit: true } });
  if (!reservation) throw new AppError("Reservation not found");

  const isDepositRef = reservation.depositReference === reference;
  const isBalanceRef = reservation.balanceReference === reference;
  if (!isDepositRef && !isBalanceRef) {
    throw new AppError("This payment reference doesn't match this reservation.");
  }

  // Idempotent — a second call (webhook-less, so the frontend's own verify
  // call may legitimately run twice on a reload) is a safe no-op.
  if (isDepositRef && reservation.depositPaid) return reservation;
  if (isBalanceRef && reservation.balancePaid) return reservation;

  const result = await verifyTransaction(reference);
  const expectedAmountKobo = Math.round(
    (isDepositRef ? reservation.depositAmount : reservation.balanceAmount) * 100,
  );
  const succeeded =
    result.status === "success" && result.amount === expectedAmountKobo && result.currency === "NGN";
  if (!succeeded) throw new AppError("Payment wasn't successful.");

  const updated = await prisma.kitReservation.update({
    where: { id },
    data: isDepositRef
      ? { depositPaid: true }
      : { balancePaid: true, status: "BALANCE_PAID" },
    include: { kit: true },
  });

  if (isDepositRef) {
    waitUntil(
      sendMail({
        to: updated.email,
        subject: "Your Black Friday Reservation",
        html: reservationConfirmationEmail({
          name: updated.fullName,
          kitName: updated.kit.name,
          totalPrice: updated.kit.totalPrice,
          depositAmount: updated.depositAmount,
          balanceAmount: updated.balanceAmount,
          balanceDueDate: updated.balanceDueDate.toLocaleDateString("en-NG", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        }),
      }).catch((err) => console.error("[reservations] Failed to send confirmation email:", err)),
    );
  }

  return updated;
}
