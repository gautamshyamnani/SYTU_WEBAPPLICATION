/**
 * env.js — Environment variable validation
 *
 * Called FIRST in server.js (before any other require).
 * If a required variable is missing the process exits immediately
 * with a clear error — no silent failures in production.
 */

const REQUIRED = [
  // Core
  { key: 'JWT_SECRET',           hint: 'Long random string for signing JWTs' },
  { key: 'MONGO_URI',            hint: 'MongoDB connection string' },
  // Razorpay
  { key: 'RAZORPAY_KEY_ID',      hint: 'From Razorpay dashboard' },
  { key: 'RAZORPAY_KEY_SECRET',  hint: 'From Razorpay dashboard' },
  { key: 'RAZORPAY_WEBHOOK_SECRET', hint: 'Set in Razorpay dashboard › Webhooks' },
  // GitHub OAuth
  { key: 'GITHUB_CLIENT_ID',     hint: 'From github.com/settings/developers' },
  { key: 'GITHUB_CLIENT_SECRET', hint: 'From github.com/settings/developers' },
  { key: 'GITHUB_CALLBACK_URL',  hint: 'Must match OAuth App callback URL exactly' },
];

const WARNINGS = [
  // Not strictly required for startup but strongly recommended in prod
  { key: 'REDIS_URL',            hint: 'redis://or rediss://... — without it, cache/queues/realtime are disabled' },
  { key: 'CLIENT_ORIGIN',        hint: 'Frontend origin for CORS, e.g. https://yourapp.com' },
  { key: 'GITHUB_TOKEN_ENC_KEY', hint: 'AES-256 key for encrypting stored GitHub tokens' },
];

function validateEnv() {
  const missing = REQUIRED.filter(({ key }) => !process.env[key]);

  if (missing.length > 0) {
    console.error('\n❌  Missing required environment variables — server cannot start:\n');
    missing.forEach(({ key, hint }) => {
      console.error(`  • ${key.padEnd(28)} — ${hint}`);
    });
    console.error('\nCheck your .env file against .env.example\n');
    process.exit(1);
  }

  // Warn about weak JWT_SECRET in production
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.JWT_SECRET &&
    process.env.JWT_SECRET.length < 32
  ) {
    console.warn('⚠️  JWT_SECRET is shorter than 32 chars — use a long random string in production');
  }

  // Soft warnings — app can run but these should be fixed
  const warned = WARNINGS.filter(({ key }) => !process.env[key]);
  if (warned.length > 0 && process.env.NODE_ENV === 'production') {
    console.warn('\n⚠️  Missing recommended environment variables:\n');
    warned.forEach(({ key, hint }) => {
      console.warn(`  • ${key.padEnd(28)} — ${hint}`);
    });
    console.warn('');
  }

  console.log('✅  Environment variables validated');
}

module.exports = { validateEnv };
