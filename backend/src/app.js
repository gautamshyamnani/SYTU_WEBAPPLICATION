/**
 * app.js — Express application factory
 *
 * Middleware order matters — see inline comments.
 *
 * Security stack (Slice 13):
 *   helmet → cors → globalLimiter → morgan
 *   → express.json → mongoSanitize → xssClean
 *   → routes
 *   → 404 handler → central error handler
 *
 * Slice 14 additions: response compression, /api/health, /api/docs (Swagger).
 */

const express      = require('express');
const cookieParser = require('cookie-parser');
const compression  = require('compression');
const swaggerUi    = require('swagger-ui-express');

const { applySecurityMiddleware, applyBodySanitizers } = require('./middleware/security');
const { globalLimiter }     = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const httpLogger            = require('./middleware/httpLogger');
const swaggerSpec           = require('./config/swagger');
const config                = require('./config');

const app = express();

// Behind a reverse proxy (Nginx, Docker, Render, Railway, ALB) in production,
// trust the X-Forwarded-* headers so req.ip / express-rate-limit see the real
// client IP instead of the proxy's. Safe no-op in development.
app.set('trust proxy', config.trustProxy);

// ─── 1. Security headers + CORS ───────────────────────────────────────────────
// Must come before everything so even error responses get secure headers.
applySecurityMiddleware(app);

// ─── 2. Response compression (gzip) ───────────────────────────────────────────
// Cheap win for JSON API payloads. Placed early so all downstream responses
// (including errors) are compressed.
app.use(compression());

// ─── 3. HTTP request logging (Morgan → Winston) ───────────────────────────────
app.use(httpLogger);

// ─── 4. Global rate limiter (100 req / 15 min / IP) ──────────────────────────
app.use(globalLimiter);

// ─── 5. Razorpay webhook — raw body BEFORE express.json() ────────────────────
// Razorpay signs the exact raw bytes. If express.json() parses first, the
// re-serialised body won't match the signature.
app.use(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' })
);

// ─── 6. Body parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));         // reject outsized payloads
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());

// ─── 7. Input sanitisation (runs AFTER body parsing) ─────────────────────────
applyBodySanitizers(app);

// ─── 8. API documentation (Swagger UI) ───────────────────────────────────────
// GET /api/docs — interactive OpenAPI explorer. Spec is generated from
// JSDoc comments in src/docs/*.swagger.js (see src/config/swagger.js).
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Auth Backend API Docs',
}));
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

// ─── 9. Routes ────────────────────────────────────────────────────────────────
// API v1 prefix — all routes live under /api/v1/
// Legacy paths (/api/*) are preserved by mounting the same routers twice
// so existing clients don't break.

const v1 = express.Router();

v1.use('/health',        require('./routes/health'));      // Slice 14
v1.use('/test',          require('./routes/test'));
v1.use('/auth',          require('./routes/auth'));
v1.use('/auth',          require('./routes/githubAuth'));  // GitHub OAuth
v1.use('/user',          require('./routes/user'));
v1.use('/users',         require('./routes/user'));        // plural alias (Slice 12 spec)
v1.use('/connections',   require('./routes/connections'));
v1.use('/discovery',     require('./routes/discovery'));
v1.use('/messages',      require('./routes/messages'));
v1.use('/payments',      require('./routes/payments'));
v1.use('/github',        require('./routes/github'));      // repo sync
v1.use('/notifications', require('./routes/notifications'));

// Mount v1 router at both /api/v1 (new) and /api (legacy)
// This also exposes GET /api/health and GET /api/v1/health.
app.use('/api/v1', v1);
app.use('/api',    v1);

// ─── 10. Legacy plain health check (pre-Slice-14, kept for compatibility) ────
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

// ─── 11. 404 handler ───────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ─── 12. Central error handler ────────────────────────────────────────────────
// Must be last and must have 4 params (err, req, res, next).
app.use(errorHandler);

module.exports = app;
