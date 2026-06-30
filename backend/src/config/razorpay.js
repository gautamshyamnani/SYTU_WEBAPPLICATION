const Razorpay = require('razorpay');

// ─── Razorpay client (singleton) ─────────────────────────────────────────────
// Mirrors the lazy-singleton pattern used for the Redis cache client.
// Credentials come from env — never hardcode keys.

let razorpayInstance = null;

const getRazorpayInstance = () => {
  if (razorpayInstance) return razorpayInstance;

  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error(
      'Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env'
    );
  }

  razorpayInstance = new Razorpay({ key_id, key_secret });
  return razorpayInstance;
};

module.exports = { getRazorpayInstance };
