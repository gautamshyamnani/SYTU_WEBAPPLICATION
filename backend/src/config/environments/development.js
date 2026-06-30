/**
 * config/development.js — Development-environment defaults
 *
 * These are sane local-dev defaults. Real secrets still come from .env
 * (see config/env.js for required-variable validation) — this file only
 * supplies non-secret behavioural knobs that differ between environments.
 */

module.exports = {
  env: 'development',
  logLevel: 'debug',
  // No reverse proxy in front of the app locally — trust proxy headers are off.
  trustProxy: false,
  // Verbose Morgan format in dev (see middleware/httpLogger.js)
  morganFormat: 'dev',
  // Helmet CSP is relaxed slightly in dev to make local tooling easier
  cors: {
    credentials: true,
  },
};
