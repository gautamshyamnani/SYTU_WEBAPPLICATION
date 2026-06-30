# Slice 13 — Security Hardening

## What was added

### Part 1 — Rate Limiting (`src/middleware/rateLimiter.js`)

| Limiter | Scope | Limit |
|---|---|---|
| `globalLimiter` | All routes, per IP | 100 req / 15 min |
| `authLimiter` | `/login`, `/register` | 10 req / 15 min |
| `createRateLimiter` | Per authenticated user (Redis) | Configurable — search uses 30 req / 60 s |

- Global and auth limiters use `express-rate-limit` (returns standard `RateLimit-*` headers)
- Per-user search limiter keeps the existing Redis fixed-window implementation (multi-instance safe)

---

### Part 2 — Security Middlewares (`src/middleware/security.js`)

| Package | What it does |
|---|---|
| `helmet` | Sets 14 secure HTTP response headers (CSP, HSTS, X-Frame-Options, etc.) |
| `cors` | Restricts origins to `CLIENT_ORIGIN` env var (comma-separated list supported) |
| `express-mongo-sanitize` | Strips `$` / `.` from request fields (NoSQL injection prevention) |
| `xss-clean` | HTML-encodes `<`, `>`, `&` in body / query / params |

CORS is configured with `credentials: true` so HTTP-only refresh-token cookies work.

---

### Part 3 — Input Validation (`src/middleware/validate.js`)

Uses `express-validator`. Validators applied per route:

| Validator | Route(s) |
|---|---|
| `validateRegister` | `POST /api/v1/auth/register` |
| `validateLogin` | `POST /api/v1/auth/login` |
| `validateProfileUpdate` | `PUT /api/v1/user/update` |
| `validateCreateOrder` | `POST /api/v1/payments/create-order` |
| `validateVerifyPayment` | `POST /api/v1/payments/verify` |
| `validateSearch` | `GET /api/v1/users/search` |
| `validateMongoId` | Any route with `:id` param |

Validation errors return:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "Must be a valid email address" }]
}
```

---

### Part 4 — Error Handling (`src/middleware/errorHandler.js`)

Central error handler catches all `next(err)` calls. Classifies:

- **Mongoose duplicate key (11000)** → 409 Conflict
- **Mongoose ValidationError** → 400 Bad Request
- **Mongoose CastError** → 400 Bad Request
- **JsonWebTokenError** → 401 Unauthorized
- **TokenExpiredError** → 401 Unauthorized
- **CORS errors** → 403 Forbidden
- **Everything else** → 500 Internal Server Error

`stack` trace only included when `NODE_ENV=development`.

---

### Part 5 — Logging (`src/config/logger.js`, `src/middleware/httpLogger.js`)

**Winston** (app logs):
- Console: coloured in dev, plain in prod
- `logs/error.log`: ERROR level only (max 5 MB × 5 files)
- `logs/combined.log`: INFO and above (max 10 MB × 5 files)

**Morgan** (HTTP request logs) streams into Winston via a write bridge.
Health-check requests (`/health`) are skipped in both loggers.

---

### Part 6 — Environment Validation (`src/config/env.js`)

Called first in `server.js` before any other code. Exits with a clear diagnostic if any of these are missing:

```
JWT_SECRET · MONGO_URI · REDIS_HOST · REDIS_PORT
RAZORPAY_KEY_ID · RAZORPAY_KEY_SECRET · RAZORPAY_WEBHOOK_SECRET
GITHUB_CLIENT_ID · GITHUB_CLIENT_SECRET · GITHUB_CALLBACK_URL
```

Also warns in production if:
- `JWT_SECRET` is shorter than 32 characters
- `CLIENT_ORIGIN` or `GITHUB_TOKEN_ENC_KEY` are absent

---

### Part 7 — API Versioning

All routes are now available under **both**:
- `/api/v1/*` — new versioned prefix
- `/api/*` — legacy prefix (preserved so existing clients don't break)

Both mount the exact same routers — no logic duplication.

---

## File structure changes

```
src/
├── config/
│   ├── env.js          ← NEW — env validation
│   ├── logger.js       ← NEW — Winston logger
│   ├── db.js           ← updated to use logger
│   └── ...unchanged
├── middleware/
│   ├── rateLimiter.js  ← updated — added globalLimiter + authLimiter
│   ├── security.js     ← NEW — helmet + cors + sanitize + xss
│   ├── validate.js     ← NEW — express-validator chains
│   ├── errorHandler.js ← NEW — central error + 404 handlers
│   ├── httpLogger.js   ← NEW — Morgan → Winston bridge
│   └── auth.js         ← unchanged
├── routes/
│   ├── auth.js         ← updated — authLimiter + validation
│   ├── user.js         ← updated — validation on update + search
│   ├── payments.js     ← updated — validation on create-order + verify
│   └── ...unchanged
├── app.js              ← updated — full security stack wired in, /api/v1 prefix
└── server.js           ← updated — validateEnv + logger on startup
logs/                   ← NEW — created at runtime by Winston
```

---

## New packages added

| Package | Version | Purpose |
|---|---|---|
| `helmet` | ^8 | HTTP security headers |
| `cors` | ^2 | CORS policy |
| `express-mongo-sanitize` | ^2 | NoSQL injection prevention |
| `xss-clean` | ^0 | XSS input sanitisation |
| `express-rate-limit` | ^8 | Global + auth rate limiting |
| `express-validator` | ^7 | Input validation |
| `morgan` | ^1 | HTTP request logging |
| `winston` | ^3 | Structured application logging |
| `joi` | ^18 | Available if needed (not wired to routes yet) |

---

## Testing the security features

### Rate limiting
```bash
# Hit /login 11 times — 11th should return 429
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:5000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
```

### Input validation
```bash
# Missing fields → 400 with errors array
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"notanemail","password":"short"}'
```

### Security headers
```bash
curl -I http://localhost:5000/health | grep -E "Content-Security|X-Frame|Strict-Transport"
```

### NoSQL injection
```bash
# { "$gt": "" } operator stripped by mongo-sanitize → safe query
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":{"$gt":""},"password":"anything"}'
```
