export const wrapper = (title: string, body: string) => `
<div style="font-family: -apple-system, Helvetica, Arial, sans-serif; background:#f4faf3; padding:32px 16px;">
  <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden;">
    <div style="background:#16241a; color:#fff; padding:24px 32px;">
      <p style="margin:0; font-size:11px; letter-spacing:0.3em; text-transform:uppercase; color:#8ab88e;">Naya Glows</p>
      <h1 style="margin:8px 0 0; font-size:20px; font-weight:600;">${title}</h1>
    </div>
    <div style="padding:32px; color:#16241a; font-size:14px; line-height:1.6;">
      ${body}
    </div>
  </div>
</div>`;

export function orderConfirmationEmail(order: {
  id: string;
  currency: string;
  total: number;
  items: { qty: number; price: number; product: { name: string } }[];
}) {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;">${i.product.name} × ${i.qty}</td><td style="padding:6px 0; text-align:right;">${order.currency} ${(i.price * i.qty).toLocaleString()}</td></tr>`,
    )
    .join("");

  return wrapper(
    "Order Confirmed",
    `
    <p>Thank you for shopping with Naya Glows! We've received your payment and your order is being prepared.</p>
    <p style="color:#16241a80; font-size:12px;">Order #${order.id}</p>
    <table style="width:100%; border-collapse:collapse; margin-top:16px;">
      ${rows}
      <tr><td style="padding-top:12px; font-weight:600; border-top:1px solid #16241a1a;">Total</td>
          <td style="padding-top:12px; font-weight:600; text-align:right; border-top:1px solid #16241a1a;">${order.currency} ${order.total.toLocaleString()}</td></tr>
    </table>
    <p style="margin-top:24px;">You can track your delivery any time using this order number on our Track Order page.</p>
  `,
  );
}

export function orderStatusUpdateEmail(order: { id: string }, stageLabel: string) {
  return wrapper(
    "Order Update",
    `
    <p>Good news — your Naya Glows order status just changed to:</p>
    <p style="font-size:18px; font-weight:600; color:#4f7957; margin:12px 0;">${stageLabel}</p>
    <p style="color:#16241a80; font-size:12px;">Order #${order.id}</p>
    <p style="margin-top:24px;">You can check the full delivery timeline any time on our Track Order page.</p>
  `,
  );
}

export function consultationReceivedEmail(req: { name: string }) {
  return wrapper(
    "We've Got Your Request",
    `<p>Hi ${req.name}, thanks for booking a skincare consultation with Naya Glows. Our team will reach out shortly to schedule your session.</p>`,
  );
}

export function consultationAdminNotification(req: {
  name: string;
  email: string;
  phone?: string | null;
  skinConcern: string;
  message?: string | null;
}) {
  return wrapper(
    "New Consultation Request",
    `
    <p><strong>${req.name}</strong> (${req.email}${req.phone ? `, ${req.phone}` : ""}) requested a consultation.</p>
    <p><strong>Skin concern:</strong> ${req.skinConcern}</p>
    ${req.message ? `<p><strong>Message:</strong> ${req.message}</p>` : ""}
  `,
  );
}

export function contactMessageAdminNotification(msg: {
  name: string;
  email: string;
  subject?: string | null;
  message: string;
}) {
  return wrapper(
    "New Contact Message",
    `
    <p><strong>${msg.name}</strong> (${msg.email}) sent a message${msg.subject ? `: <strong>${msg.subject}</strong>` : ""}.</p>
    <p>${msg.message}</p>
  `,
  );
}

export function wholesaleInquiryAdminNotification(inquiry: {
  businessName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  message?: string | null;
}) {
  return wrapper(
    "New Wholesale Inquiry",
    `
    <p><strong>${inquiry.businessName}</strong> — ${inquiry.contactName} (${inquiry.email}${inquiry.phone ? `, ${inquiry.phone}` : ""}) is interested in stocking Naya Glows.</p>
    ${inquiry.message ? `<p><strong>Message:</strong> ${inquiry.message}</p>` : ""}
  `,
  );
}
