import "dotenv/config";
import { sendMail } from "../src/lib/mailer";
import { orderConfirmationEmail } from "../src/lib/emailTemplates";

// One-off: sends a sample of the branded order-confirmation template
// (the richest of the templates — header, itemized table, total) to a real
// inbox so the look can be checked outside of a mail client's own preview.
async function main() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set — check backend/.env");
  }

  const sampleEmail = "emmakobi91@gmail.com";
  const sampleOrder = {
    id: "cmy-sample-preview",
    currency: "NGN",
    total: 24800,
    items: [
      { qty: 1, price: 15000, product: { name: "Radiance Boost Serum (Vitamin C)" } },
      { qty: 1, price: 9800, product: { name: "Radiant Balance Toner" } },
    ],
  };

  await sendMail({
    to: sampleEmail,
    subject: "Naya Glows — sample email template preview",
    html: orderConfirmationEmail(sampleOrder, sampleEmail),
  });

  console.log("Sent.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
