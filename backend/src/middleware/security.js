/**
 * security.js — Centralised HTTP security middleware
 *
 * Applies in order inside app.js:
 *   1. helmet    — sets secure HTTP response headers
 *   2. cors      — restricts cross-origin access to trusted origins
 *   3. mongoSanitize — strips $ and . from request fields (NoSQL injection)
 *   4. xssClean  — escapes HTML entities in req.body / query / params
 *
 * Kept in one file so security posture is easy to audit in one place.
 */

const helmet       = require('helmet');
const cors         = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const xssClean     = require('xss-clean');

// ─── Trusted origins ─────────────────────────────────────────────────────────
// CLIENT_ORIGIN can be a comma-separated list for multi-origin setups:
//   CLIENT_ORIGIN=https://app.example.com,https://admin.example.com
const TRUSTED_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const normalizeOrigin = (origin) => origin?.replace(/\/$/, '');
const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);
  const isTrusted = TRUSTED_ORIGINS.some(
    (allowedOrigin) => normalizeOrigin(allowedOrigin) === normalizedOrigin
  );

  if (isTrusted) return true;

  const isLocalhost = /^(http|https):\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin);
  const isVercelDomain = /^(https):\/\/([a-z0-9-]+\.)*vercel\.app$/i.test(normalizedOrigin);

  return isLocalhost || isVercelDomain;
};

// ─── Helmet ───────────────────────────────────────────────────────────────────
const helmetMiddleware = helmet({
  // Content-Security-Policy — sensible defaults; tighten per frontend needs
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'"],
      objectSrc:  ["'none'"],
      frameSrc:   ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // relax if serving mixed content
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200,
};

const corsMiddleware = cors(corsOptions);

// ─── MongoDB sanitise ─────────────────────────────────────────────────────────
// Removes keys starting with '$' or containing '.' to prevent operator injection.
// replaceWith: '_' turns e.g. {"$gt":""} → {"_gt":""} instead of stripping the key.
const mongoSanitizeMiddleware = mongoSanitize({ replaceWith: '_' });

// ─── XSS clean ───────────────────────────────────────────────────────────────
// Sanitises req.body, req.query, req.params by escaping < > & etc.
const xssMiddleware = xssClean();

// ─── Export ───────────────────────────────────────────────────────────────────
/**
 * applySecurityMiddleware(app)
 *
 * Call once in app.js before any route handlers.
 * Separated from app.js so testing can apply middleware selectively.
 */
function applySecurityMiddleware(app) {
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.options('*', corsMiddleware); // pre-flight for all routes

  // Sanitisation runs AFTER body-parsing (needs parsed body to sanitise it),
  // so these are exported separately and applied after express.json() in app.js.
  // See applyBodySanitizers() below.
}

/**
 * applyBodySanitizers(app)
 *
 * Must be called AFTER express.json() / express.urlencoded() in app.js.
 */
function applyBodySanitizers(app) {
  app.use(mongoSanitizeMiddleware);
  app.use(xssMiddleware);
}

module.exports = { applySecurityMiddleware, applyBodySanitizers };
