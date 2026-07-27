import "dotenv/config";
import { sendMail } from "../src/lib/mailer";
import { orderConfirmationEmail } from "../src/lib/emailTemplates";

// One-off: sends a sample of the branded order-confirmation template
// (the richest of the templates — header, itemized table, total) to a real
// inbox so the look can be checked outside of a mail client's own preview.
async function main() {
  if (!process.env.SMTP_HOST) {
    throw new Error("SMTP_HOST is not set — check backend/.env");
  }

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
    to: "emmakobi91@gmail.com",
    subject: "Naya Glows — sample email template preview",
    html: orderConfirmationEmail(sampleOrder),
  });

  console.log("Sent.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
