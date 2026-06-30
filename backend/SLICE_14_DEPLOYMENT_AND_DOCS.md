# Slice 14 — Final Backend Polish (Deployment, Docs, Production Readiness)

## What was added

### New files

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build (deps → runtime), Node 20-alpine, non-root user, `dumb-init` for correct signal handling, built-in `HEALTHCHECK` against `/api/health` |
| `docker-compose.yml` | Brings up `backend` + `mongo` + `redis` together, with health-checked startup ordering and named volumes |
| `.dockerignore` | Keeps `node_modules`, `.env`, logs, and docs out of the build context |
| `.gitignore` | Was missing entirely — added standard Node/env/log/editor ignores |
| `src/routes/health.js` + `src/controllers/healthController.js` | `GET /api/health` — returns `{ status, uptime, timestamp, services: { mongo, redis } }` |
| `src/config/swagger.js` | Builds the OpenAPI 3.0 spec via `swagger-jsdoc`, scanning `src/docs/*.swagger.js` |
| `src/docs/*.swagger.js` (8 files) | OpenAPI annotations for every route group — auth, user/search, connections/discovery, messages, payments, github, notifications, health. **No route logic lives here** — these files exist purely to be parsed by `swagger-jsdoc`, so documenting the API required zero changes to working route files. |
| `src/seed/seed.js` | Seeds 5 sample users + 5 sample connections (mix of `pending`/`accepted`). Idempotent — re-running skips users/connections that already exist. `--fresh` flag wipes previously-seeded data first. Refuses to run against `NODE_ENV=production` unless `ALLOW_PROD_SEED=true` is explicitly set. |
| `src/config/environments/development.js`, `src/config/environments/production.js`, `src/config/index.js` | Environment-aware config loader — currently controls Morgan log format and the Express `trust proxy` setting (see below); designed to grow as more env-specific knobs are needed |
| `SLICE_14_DEPLOYMENT_AND_DOCS.md` | This file |

### Surgically modified (minimal changes, nothing broken)

| File | Change |
|---|---|
| `src/app.js` | Added `compression()` (gzip), mounted `swagger-ui-express` at `GET /api/docs` (+ `GET /api/docs.json` for the raw spec), mounted the new health router inside the existing `v1` router (so it's reachable at both `/api/health` and `/api/v1/health`), added `app.set('trust proxy', config.trustProxy)`. The pre-existing plain-text `GET /health` route was **kept as-is** for backward compatibility with anything already polling it. |
| `src/middleware/httpLogger.js` | Now reads its Morgan format from `config/index.js` instead of inlining the `NODE_ENV` check — same behavior, just centralized. Also skips `/api/health` from request logging (it already skipped `/health`). |
| `src/middleware/rateLimiter.js` | `globalLimiter`'s skip list now also excludes `/api/health`, so uptime monitors hitting the new route don't get rate-limited or count against real traffic. |
| `src/server.js` | Added SIGINT/SIGTERM graceful shutdown (see below). Workers are now imported by destructured name (`{ emailWorker }` etc.) instead of side-effect-only `require()`, so `server.js` can call `.close()` on them during shutdown — the workers still register their BullMQ listeners exactly as before. |
| `package.json` | Added `compression`, `swagger-jsdoc`, `swagger-ui-express` as dependencies. Added `npm run seed` / `npm run seed:fresh` scripts. Bumped the description string. |
| Root of the project | Removed a stray empty directory (`src/{config,models,controllers,middleware,routes}`) left over from an earlier `mkdir` that didn't get brace-expanded — pure cleanup, no code impact. |

No existing controller, model, or business-logic file was touched. Every route added in prior slices behaves identically — Slice 14 only adds infrastructure around the existing API surface.

---

## Part 1 — Dockerization

```bash
# Build and run everything (API + Mongo + Redis) in one command
cp .env.example .env        # fill in real secrets first
docker compose up --build
```

- The `backend` service waits for Mongo and Redis to report healthy before starting (via `depends_on: condition: service_healthy`).
- Inside the Docker network, the backend reaches Mongo/Redis by service name (`mongo`, `redis`) — `docker-compose.yml` overrides `MONGO_URI`/`REDIS_HOST`/`REDIS_PORT` for you, so your `.env`'s `localhost` values are untouched and still work if you run the app outside Docker.
- Data persists across `docker compose down` via the `mongo-data` / `redis-data` named volumes (use `down -v` to wipe them).
- The image runs as a non-root user and uses `dumb-init` as PID 1 so `docker stop` correctly delivers `SIGTERM` to the Node process (see Part 6).

To run just the backend image against external Mongo/Redis:
```bash
docker build -t auth-backend .
docker run --env-file .env -p 5000:5000 auth-backend
```

---

## Part 2 — Health Check

```
GET /api/health        (also available at /api/v1/health)
```
```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2026-06-28T13:39:53.344Z",
  "services": { "mongo": "connected", "redis": "connected" }
}
```
- Not behind `protect` — must be reachable with no auth (for load balancers / Docker `HEALTHCHECK`).
- Excluded from both request logging and the global rate limiter.
- The pre-existing `GET /health` (no `/api` prefix) still works unchanged.

---

## Part 3 — API Documentation

```
GET /api/docs          interactive Swagger UI
GET /api/docs.json     raw OpenAPI 3.0 spec
```

All 9 route groups are documented (Health, Auth, User, Connections, Discovery, Messages, Payments, GitHub, Notifications) — 26 endpoints total, including request bodies, query params, response shapes, and the standard error schema. JWT auth is modeled as a `bearerAuth` security scheme; click **Authorize** in the UI and paste an access token to try protected routes directly from the browser.

---

## Part 4 — Seed Script

```bash
npm run seed         # add sample data (idempotent — skips existing users)
npm run seed:fresh   # wipe previously-seeded users/connections, then re-seed
```

Creates 5 sample users (`@seed.local` emails, password `Password123` for all) and 5 connections between them (mix of `pending` and `accepted`), so you can immediately exercise login, discovery, connections, and search without registering accounts by hand. The script only ever touches users/connections it created itself — it never deletes or modifies real data, and it refuses to run against a database with `NODE_ENV=production` unless you explicitly set `ALLOW_PROD_SEED=true`.

---

## Part 5 — Production Config

| Setting | Development | Production |
|---|---|---|
| Morgan log format | `dev` (concise, colored) | `combined` (Apache-style) |
| Express `trust proxy` | `false` | `1` (trust exactly one proxy hop) |

`trust proxy` is intentionally **not** set to `true` in production. `express-rate-limit` actively refuses to start with `true` because it trusts every hop in `X-Forwarded-For`, letting a client spoof their own IP and bypass IP-based rate limiting entirely. Set to `1` here on the assumption of a single reverse proxy/load balancer in front of the container (Nginx, Docker, Render, Railway, an ALB, etc.) — adjust the number in `src/config/environments/production.js` if your deployment has more hops in front of it.

Response compression (`compression` middleware) is enabled unconditionally — it's a safe, cheap win for JSON payloads in both environments.

---

## Part 6 — Final Cleanup

- Removed a stray empty directory artifact (`src/{config,models,...}`).
- Added the missing `.gitignore` (the repo had none — `node_modules`, `.env`, and `logs/` were one `git add .` away from being committed).
- Verified every local `require()` in `src/` resolves correctly and every file passes `node -c` syntax checking.
- `joi` remains in `package.json` — it's listed in Slice 13's own doc as an intentional placeholder dependency ("available if needed, not wired to routes yet"), not dead code, so it was left as-is rather than removed.

### Graceful Shutdown (Optional — implemented)

`src/server.js` now listens for `SIGINT` and `SIGTERM` and shuts down in order:

1. Stop accepting new HTTP connections (`httpServer.close()`)
2. Close the three BullMQ workers (lets in-flight jobs finish)
3. Close the Mongoose connection
4. Quit the Redis cache client
5. Exit `0`

A 10-second force-exit timer guards against anything hanging indefinitely. This matters specifically under Docker: `docker stop` sends `SIGTERM` and then `SIGKILL` after a grace period — without a handler, in-flight requests and queued jobs can be dropped mid-write. The Dockerfile's `dumb-init` entrypoint ensures that `SIGTERM` actually reaches the Node process (Node as PID 1 doesn't get signals forwarded automatically).

---

## Testing the Slice 14 additions

```bash
# Health check
curl http://localhost:5000/api/health

# Swagger UI (open in a browser)
open http://localhost:5000/api/docs

# Raw OpenAPI spec
curl http://localhost:5000/api/docs.json | jq '.paths | keys'

# Seed sample data, then log in as one of the seeded users
npm run seed
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"asha@seed.local","password":"Password123"}'

# Graceful shutdown — start the server, then in another terminal:
kill -TERM <pid>     # watch the logs show the ordered shutdown sequence
```
