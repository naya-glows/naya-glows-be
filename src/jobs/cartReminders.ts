import { findAbandonedCarts, markReminderSent, type CartItemSnapshot } from "../modules/cart/cart.service";
import { sendMail } from "../lib/mailer";
import { cartReminderEmail } from "../lib/emailTemplates";

// Runs on an interval from index.ts (no separate cron infra on Railway) —
// finds carts untouched for 14+ days that haven't been reminded about yet
// and emails their owner. Sequential like the email-campaigns send, so a
// large batch doesn't burst the SMTP connection.
export async function runAbandonedCartReminders() {
  const carts = await findAbandonedCarts();
  if (carts.length === 0) return;

  console.log(`[cart-reminders] Found ${carts.length} abandoned cart(s) to remind.`);

  for (const cart of carts) {
    try {
      const items = cart.items as unknown as CartItemSnapshot[];
      await sendMail({
        to: cart.user.email,
        subject: "You left something in your cart",
        html: cartReminderEmail(cart.user.name, items),
      });
      await markReminderSent(cart.id);
    } catch (err) {
      console.error(`[cart-reminders] Failed for user=${cart.userId}:`, err);
    }
  }
}
