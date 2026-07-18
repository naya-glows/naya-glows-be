const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
}

type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

export async function initializeTransaction(input: {
  email: string;
  amountMinorUnits: number;
  currency: string;
  reference: string;
  callbackUrl: string;
}): Promise<PaystackInitializeResponse["data"]> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountMinorUnits,
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
    }),
  });

  const body = (await res.json()) as PaystackInitializeResponse;
  if (!res.ok || !body.status) {
    throw new Error(body.message || "Failed to initialize Paystack transaction");
  }
  return body.data;
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
