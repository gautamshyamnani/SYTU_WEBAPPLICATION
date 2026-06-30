# Slice 9 — Payments + Webhooks (Razorpay)

## What was added

| File | Purpose |
|---|---|
| `src/config/razorpay.js` | Lazy-singleton Razorpay SDK client, built from `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`. |
| `src/models/Payment.js` | `Payment` model — `userId`, `orderId` (unique), `paymentId`, `amount`, `currency`, `status` (`created`/`success`/`failed`), `lastWebhookEvent`, `failureReason`, timestamps. |
| `src/controllers/paymentController.js` | `createOrder`, `verifyPayment`, `handleWebhook`. |
| `src/routes/payments.js` | `POST /create-order`, `POST /verify` (both behind `protect`), `POST /webhook` (signature-verified, not JWT-protected). |
| `src/models/User.js` | Added `isPremium: Boolean` (default `false`). Exposed in `authController`'s and `userController`'s response shapes. |
| `src/app.js` | Mounted `/api/payments`. Added a **path-scoped** `express.raw()` for `/api/payments/webhook`, registered before the global `express.json()`, so the webhook handler gets the exact raw bytes Razorpay signed. Every other route is unaffected — verified with a direct test (see below). |
| `.env.example` | Added `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. |
| `package.json` | Added `razorpay` SDK dependency. |
| `postman/slice9-payments.postman_collection.json` | Postman collection covering the full flow, including failure cases and an idempotency replay test. |

## Why the webhook route needs raw body

Razorpay computes `HMAC_SHA256(rawRequestBody, webhookSecret)` over the **exact bytes** it sent. If `express.json()` parses the body first, you're left with a JS object — re-serializing it with `JSON.stringify()` is not guaranteed to match Razorpay's original byte sequence (key order, spacing, etc. can differ), which silently breaks signature verification. `app.js` mounts `express.raw({ type: 'application/json' })` on the exact `/api/payments/webhook` path *before* the global JSON parser, so:

- The webhook handler gets `req.body` as a `Buffer`.
- Every other route keeps using `express.json()` exactly as before — confirmed by loading `app.js` and listing all routes, and by sending requests to both a raw-mounted and a normal route in the same process.

## Security properties

- **Order creation** is JWT-protected; amount/currency are validated server-side (positive, capped, allow-listed currency) — the client never dictates final pricing beyond the validated `amount` field.
- **`/verify`** independently recomputes the `order_id|payment_id` HMAC using `RAZORPAY_KEY_SECRET` and compares with `crypto.timingSafeEqual` — the client's claimed outcome is never trusted on its own. Ownership is checked (`payment.userId` vs `req.user._id`) so one user can't verify/claim another user's order.
- **`/webhook`** verifies `X-Razorpay-Signature` against the raw body using `Razorpay.validateWebhookSignature` (the SDK's public static helper) with `RAZORPAY_WEBHOOK_SECRET` — a separate secret from the API key, as Razorpay recommends.
- **Idempotency**: both `/verify` and the webhook check current status before transitioning (`if (payment.status !== 'success')`), and the webhook additionally tracks `lastWebhookEvent` so a retried/duplicate event for the same outcome is a no-op. A late `payment.failed` event can never downgrade a payment already confirmed `success`.
- **Premium upgrade** (`applyPremiumOnSuccess`) is a single shared function called from both the `/verify` success path and the webhook `payment.captured` path, so the logic only lives in one place and is safe to call more than once.

## What is intentionally out of scope (per the task)

- No frontend checkout UI.
- No subscription plans — `isPremium` is a flat boolean, not a plan/tier system.
- No refund handling, `order.paid` event handling, or other Razorpay event types — webhook explicitly acknowledges (200) and ignores anything other than `payment.captured` / `payment.failed` so Razorpay doesn't keep retrying them.

## Testing performed

Since this sandbox has no real MongoDB or live Razorpay credentials, verification was split into two layers:

1. **Wiring check** — loaded the real `app.js` and listed every registered route to confirm `/api/payments/create-order`, `/verify`, and `/webhook` are mounted and every pre-existing route is untouched.
2. **Raw-body isolation check** — a standalone Express app with the same `express.raw()` scoping proved the webhook route receives a `Buffer` while a sibling route still receives parsed JSON.
3. **Controller logic** — the real, unmodified `paymentController.js` was exercised against lightweight in-memory fakes of the `Payment`/`User`/`razorpay` modules (23 assertions): input validation, correct/incorrect signature handling for both `/verify` and the webhook, ownership checks, `isPremium` upgrade, and idempotency (replayed and out-of-order webhook events).

Before deploying, run the included Postman collection (or equivalent) against a real server with test-mode Razorpay credentials and a real MongoDB to confirm the same behavior end-to-end.
