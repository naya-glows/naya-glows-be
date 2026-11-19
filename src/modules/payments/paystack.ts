const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
}

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data: {
    status: "success" | "failed" | "abandoned" | string;
    reference: string;
    amount: number;
    currency: string;
  };
};

export async function verifyTransaction(
  reference: string,
): Promise<PaystackVerifyResponse["data"]> {
  const res = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${getSecretKey()}` },
    },
  );

  const body = (await res.json()) as PaystackVerifyResponse;
  if (!res.ok || !body.status) {
    throw new Error(body.message || "Failed to verify Paystack transaction");
  }
  return body.data;
}

type PaystackRefundResponse = {
  status: boolean;
  message: string;
  data?: {
    transaction_reference: string;
    amount: number;
    status: string;
  };
};

// `amountKobo` omitted means a full refund of whatever the transaction was
// actually charged — Paystack looks that up itself from the reference, we
// never need to (and shouldn't) tell it an amount for a full refund.
export async function refundTransaction(
  reference: string,
  amountKobo?: number,
): Promise<PaystackRefundResponse["data"]> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transaction: reference,
      ...(amountKobo ? { amount: amountKobo } : {}),
    }),
  });

  const body = (await res.json()) as PaystackRefundResponse;
  if (!res.ok || !body.status) {
    throw new Error(body.message || "Failed to process refund with Paystack");
  }
  return body.data;
}
