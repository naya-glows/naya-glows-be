export const wrapper = (title: string, body: string) => `
<div style="font-family: -apple-system, Helvetica, Arial, sans-serif; background:#f4faf3; padding:32px 16px;">
  <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden;">
    <div style="background:#16241a; color:#fff; padding:24px 32px;">
      <img src="https://res.cloudinary.com/bhozkz7o/image/upload/v1784381892/naya-glows/legacy/naya-logo.png" alt="Naya Glows" width="36" height="36" style="display:block; margin-bottom:12px; border-radius:50%; background:#fff;" />
      <p style="margin:0; font-size:11px; letter-spacing:0.3em; text-transform:uppercase; color:#8ab88e;">Naya Glows</p>
      <h1 style="margin:8px 0 0; font-size:20px; font-weight:600;">${title}</h1>
    </div>
    <div style="padding:32px; color:#16241a; font-size:14px; line-height:1.6;">
      ${body}
    </div>
  </div>
</div>`;

export function signupOtpEmail(code: string) {
  return wrapper(
    "Verify Your Email",
    `
    <p>Welcome to Naya Glows! Use the code below to verify your email and finish creating your account.</p>
    <p style="font-size:32px; font-weight:700; letter-spacing:0.25em; text-align:center; color:#16241a; background:#f4faf3; border-radius:12px; padding:16px; margin:20px 0;">${code}</p>
    <p style="color:#16241a80; font-size:12px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
  `,
  );
}

export function cartReminderEmail(name: string, items: { name: string; qty: number }[]) {
  const rows = items
    .map((i) => `<li style="margin-bottom:6px;">${i.name} × ${i.qty}</li>`)
    .join("");

  return wrapper(
    "You Left Something Behind",
    `
    <p>Hi ${name}, you still have items waiting in your Naya Glows cart:</p>
    <ul style="padding-left:20px; margin:16px 0;">${rows}</ul>
    <p>They won't wait forever — come back and finish checking out whenever you're ready.</p>
    <p style="margin-top:24px;">
      <a href="https://nayaglows.skin/cart" style="display:inline-block; background:#16241a; color:#fff; text-decoration:none; padding:12px 24px; border-radius:999px; font-weight:600; font-size:13px;">View Your Cart</a>
    </p>
  `,
  );
}

export function welcomeEmail(name: string) {
  return wrapper(
    "You're In!",
    `
    <p>Hi ${name}, welcome to Naya Glows — your email is verified and your account is ready to go.</p>
    <p>Browse the catalog, save your favorites, and track every order from your account page any time.</p>
  `,
  );
}

export function loginOtpEmail(code: string) {
  return wrapper(
    "Your Sign-In Code",
    `
    <p>Use the code below to sign in to Naya Glows.</p>
    <p style="font-size:32px; font-weight:700; letter-spacing:0.25em; text-align:center; color:#16241a; background:#f4faf3; border-radius:12px; padding:16px; margin:20px 0;">${code}</p>
    <p style="color:#16241a80; font-size:12px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
  `,
  );
}

export function orderConfirmationEmail(
  order: {
    id: string;
    currency: string;
    total: number;
    items: { qty: number; price: number; product: { name: string } }[];
  },
  email: string,
) {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;">${i.product.name} × ${i.qty}</td><td style="padding:6px 0; text-align:right;">${order.currency} ${(i.price * i.qty).toLocaleString()}</td></tr>`,
    )
    .join("");

  // Same guest-friendly ?id=&email= link the post-checkout verify page
  // redirects to (track.ts's /track/:id route only needs the order's own
  // contact email as proof of ownership) — this works whether or not the
  // recipient is signed in, or even has an account at all, so the button
  // never needs to detour through a login first. If they DO happen to click
  // through to sign in anyway, /track-order still isn't auth-gated, so
  // there's nothing for a login to interrupt.
  const trackUrl = `https://nayaglows.skin/track-order?id=${encodeURIComponent(order.id)}&email=${encodeURIComponent(email)}`;

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
    <p style="margin-top:24px;">
      <a href="${trackUrl}" style="display:inline-block; background:#16241a; color:#fff; text-decoration:none; padding:12px 24px; border-radius:999px; font-weight:600; font-size:13px;">Track Your Order</a>
    </p>
  `,
  );
}

export function subscriptionCodeEmail(items: { name: string; code: string }[]) {
  const rows = items
    .map(
      (i) => `
      <div style="background:#f4faf3; border-radius:12px; padding:16px; margin-bottom:12px;">
        <p style="margin:0 0 6px; font-weight:600;">${i.name}</p>
        <p style="margin:0; font-size:24px; font-weight:700; letter-spacing:0.15em; color:#16241a;">${i.code}</p>
      </div>`,
    )
    .join("");

  return wrapper(
    "You've Unlocked a Reorder Discount",
    `
    <p>Thanks for shopping with Naya Glows! Since you've now bought the product(s) below, you've unlocked a standing discount on every future reorder — no code needed at checkout, it's applied automatically to your account. Keep the code(s) below for your records, or reference them if you're ordering with us directly.</p>
    ${rows}
    <p style="color:#16241a80; font-size:12px; margin-top:16px;">This discount stays active for as long as you keep this account, on every future purchase of these products.</p>
  `,
  );
}

export function subscriptionPlanConfirmationEmail(plan: {
  termLabel: string;
  totalPaid: number;
  currency: string;
  fulfillmentMode: string;
  items: { name: string; qtyPerMonth: number }[];
}) {
  const rows = plan.items
    .map((i) => `<li style="margin-bottom:6px;">${i.name} — ${i.qtyPerMonth}/month</li>`)
    .join("");

  return wrapper(
    "Your Subscribe & Save Plan Is Confirmed",
    `
    <p>You're all set on your ${plan.termLabel} Subscribe &amp; Save plan — thank you for choosing to stick with Naya Glows!</p>
    <ul style="padding-left:20px; margin:16px 0;">${rows}</ul>
    <p style="font-weight:600;">Total paid: ${plan.currency} ${plan.totalPaid.toLocaleString()}</p>
    <p style="margin-top:16px;">
      ${
        plan.fulfillmentMode === "recurring"
          ? "Your first shipment is on its way now, and we'll automatically send the next one each month for the rest of your plan — no further action needed from you."
          : "Your full order for this plan is on its way now, all at once."
      }
    </p>
  `,
  );
}

export function subscriptionShipmentEmail(termLabel: string, items: { name: string; qty: number }[]) {
  const rows = items
    .map((i) => `<li style="margin-bottom:6px;">${i.name} × ${i.qty}</li>`)
    .join("");

  return wrapper(
    "Your Next Shipment Is On Its Way",
    `
    <p>This month's shipment from your ${termLabel} Subscribe &amp; Save plan is being prepared:</p>
    <ul style="padding-left:20px; margin:16px 0;">${rows}</ul>
    <p style="color:#16241a80; font-size:12px;">Already paid for as part of your plan — nothing further to do.</p>
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
