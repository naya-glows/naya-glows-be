import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/appError";
import { initializeTransaction, verifyTransaction } from "../payments/paystack";

// Fixed per the client's brief — "White-Label Consultation Fee: ₦50,000."
// One flat fee, no admin-editable pricing, same reasoning as
// BLACK_FRIDAY_BALANCE_DUE_DATE in reservations.service.ts.
export const WHITE_LABEL_CONSULTATION_FEE_NGN = 50_000;

export function getWholesaleInquiryById(id: string) {
  return prisma.wholesaleInquiry.findUnique({ where: { id } });
}

export async function initiateWhiteLabelPayment(id: string, callbackUrl: string) {
  const inquiry = await prisma.wholesaleInquiry.findUnique({ where: { id } });
  if (!inquiry) throw new AppError("Inquiry not found");
  if (inquiry.type !== "WHITE_LABEL") {
    throw new AppError("This inquiry type doesn't require a consultation fee.");
  }
  if (inquiry.paid) throw new AppError("This consultation fee has already been paid.");

  const feeNgn = inquiry.feeNgn ?? WHITE_LABEL_CONSULTATION_FEE_NGN;
  const reference = `naya-wl-${inquiry.id}-${Date.now()}`;
  const { authorization_url: authorizationUrl } = await initializeTransaction({
    email: inquiry.email,
    amountKobo: Math.round(feeNgn * 100),
    currency: "NGN",
    reference,
    callbackUrl,
  });

  await prisma.wholesaleInquiry.update({ where: { id }, data: { paymentReference: reference } });

  return { authorizationUrl };
}

export async function verifyWhiteLabelPayment(id: string, reference: string) {
  const inquiry = await prisma.wholesaleInquiry.findUnique({ where: { id } });
  if (!inquiry) throw new AppError("Inquiry not found");
  if (inquiry.paymentReference !== reference) {
    throw new AppError("This payment reference doesn't match this inquiry.");
  }

  // Idempotent, same reasoning as verifyReservationPayment.
  if (inquiry.paid) return inquiry;

  const result = await verifyTransaction(reference);
  const expectedAmountKobo = Math.round((inquiry.feeNgn ?? WHITE_LABEL_CONSULTATION_FEE_NGN) * 100);
  const succeeded =
    result.status === "success" && result.amount === expectedAmountKobo && result.currency === "NGN";
  if (!succeeded) throw new AppError("Payment wasn't successful.");

  return prisma.wholesaleInquiry.update({ where: { id }, data: { paid: true, status: "PAID" } });
}
