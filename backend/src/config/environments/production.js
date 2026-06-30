/**
 * config/production.js — Production-environment defaults
 *
 * Real secrets still come from .env (see config/env.js for required-variable
 * validation) — this file only supplies non-secret behavioural knobs that
 * differ between environments.
 */

module.exports = {
  env: 'production',
  logLevel: 'info',
  // Required when running behind a reverse proxy / load balancer (Nginx,
  // Render, Railway, AWS ALB, Docker, etc.) so req.ip and express-rate-limit
  // see the real client IP instead of the proxy's.
  //
  // Set to the exact number of proxy hops in front of this app (1 is the
  // common case — a single Nginx/LB in front of the container). Using
  // `true` here would trust every hop in X-Forwarded-For, letting a client
  // spoof their own IP and bypass rate limiting entirely — express-rate-limit
  // refuses to start with that setting for exactly this reason.
  trustProxy: 1,
  // Combined Apache-style format in prod (see middleware/httpLogger.js)
  morganFormat: 'combined',
  cors: {
    credentials: true,
  },
};
