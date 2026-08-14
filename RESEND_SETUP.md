# Setting up Resend for nayaglows.skin

This app sends all transactional email (sign-in/sign-up OTP codes, order
confirmations, cart reminders, consultation/wholesale notifications, admin
email campaigns) through [Resend](https://resend.com)'s HTTP API — see
`backend/src/lib/mailer.ts`. It replaced SMTP because Railway blocks
outbound SMTP ports on the Hobby plan; Resend sends over plain HTTPS
instead, which isn't blocked.

Two separate things happen below: **(1) verifying the domain so Resend is
allowed to send email *as* `@nayaglows.skin`**, and **(2) getting an API
key**. Note that Resend is *outbound-only* — verifying the domain lets you
send FROM an address like `no-reply@nayaglows.skin`, but it does not give
you an inbox that can receive replies. If you want a real mailbox people
can reply to (e.g. `hello@nayaglows.skin`), see the note at the bottom.

## 1. Create a Resend account

Go to [resend.com](https://resend.com) and sign up (their free tier is
plenty for this app's volume — 3,000 emails/month, 100/day).

## 2. Add and verify the domain

1. In the Resend dashboard, go to **Domains** → **Add Domain**.
2. Enter `nayaglows.skin`.
3. Resend will show you a handful of DNS records to add — typically one
   **MX** (or none, if you're not routing inbound mail through Resend), a
   few **TXT** records (SPF + DKIM), and possibly a **DMARC** TXT record.
4. Go to wherever `nayaglows.skin` is registered/managed (your domain
   registrar or DNS host — e.g. Namecheap, Cloudflare, GoDaddy) and add
   each record exactly as shown.
5. Back in Resend, click **Verify DNS Records**. Propagation is usually
   fast (minutes) but can occasionally take a few hours.

Once verified, Resend will let you send from any address `@nayaglows.skin`
— you don't need to separately "create" a mailbox for each sender address
(`no-reply@`, `hello@`, `orders@`, etc.) just to send from it.

## 3. Get an API key

1. In Resend, go to **API Keys** → **Create API Key**.
2. Give it a name (e.g. "naya-glows-backend") and **Sending access** only
   (no need for full account access).
3. Copy the key — it's only shown once.

## 4. Set the environment variables

Two variables control this, both already wired into `mailer.ts`:

- `RESEND_API_KEY` — the key from step 3.
- `RESEND_FROM_EMAIL` — already set on the live Railway service to
  `Naya Glows <no-reply@nayaglows.skin>`. Change it if you'd rather send
  from a different address on the verified domain.

Only `RESEND_API_KEY` is still missing. Set it with:

```
railway variable set RESEND_API_KEY=re_your_key_here --service incredible-truth
```

(or paste the key into the Railway dashboard → the backend service →
Variables tab). Until it's set, the app degrades gracefully — emails are
logged to the server console instead of sent, exactly like before when
SMTP wasn't configured, so nothing breaks in the meantime.

For local development, add the same key to `backend/.env`, or leave it
blank to keep seeing OTP codes printed in your terminal instead of emailed.

## About receiving email at `@nayaglows.skin`

Resend only sends. If you want an actual inbox — e.g. so replies to
`hello@nayaglows.skin` land somewhere someone can read — that's a separate
service (Google Workspace, Zoho Mail, Cloudflare Email Routing, etc.), set
up independently of Resend, usually via an MX record on the domain. Resend
support docs cover running both side-by-side without conflict if you go
that route.
