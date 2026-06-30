# Auth Backend

A MERN backend covering authentication, profiles, connections, discovery,
real-time chat, payments (Razorpay), GitHub OAuth, notifications, search, and
security hardening — built up incrementally across 14 slices.

## Stack

Node.js · Express · MongoDB (Mongoose) · Redis (cache, rate-limiting, BullMQ,
Socket.IO adapter) · Socket.IO · BullMQ (background jobs) · Razorpay ·
GitHub OAuth · Winston (logging) · Swagger / OpenAPI 3.0

## Quick start (Docker — recommended)

```bash
cp .env.example .env     # fill in real secrets
docker compose up --build
```

The API is now running at `http://localhost:5000`.

| What | Where |
|---|---|
| API base | `http://localhost:5000/api` (also `/api/v1`) |
| Interactive docs | `http://localhost:5000/api/docs` |
| Raw OpenAPI spec | `http://localhost:5000/api/docs.json` |
| Health check | `http://localhost:5000/api/health` |

Seed some sample data to explore the API immediately:
```bash
docker compose exec backend npm run seed
```

## Quick start (without Docker)

Requires Node 20+, a running MongoDB instance, and a running Redis instance.

```bash
npm install
cp .env.example .env      # point MONGO_URI / REDIS_HOST at your local instances
npm run dev                # nodemon, auto-restarts on change
# or: npm start             # plain node, for a production-like run
```

## Project structure

```
src/
  app.js                 Express app factory — middleware + route mounting
  server.js               Entry point — DB/Redis connect, graceful shutdown
  config/                 DB, Redis, JWT, logger, Swagger, env-specific config
  controllers/            Route handlers, one file per resource
  middleware/              Auth, validation, rate limiting, security, errors
  models/                 Mongoose schemas
  queues/  + workers/      BullMQ background jobs (email, notifications, GitHub sync)
  routes/                  Express routers, one file per resource
  docs/                    OpenAPI annotations (scanned by config/swagger.js)
  seed/                    Database seed script
postman/                  Postman collections for manual testing
Dockerfile, docker-compose.yml, .dockerignore
SLICE_*.md                Per-slice changelog/documentation
```

## Environment variables

See `.env.example` for the full list with explanations. The app fails fast
with a clear message (`src/config/env.js`) if any required variable is
missing — there are no silent fallbacks to insecure defaults in production.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Run the server (production mode, no auto-restart) |
| `npm run dev` | Run the server with nodemon (auto-restart on file change) |
| `npm run seed` | Add sample users + connections (safe to re-run) |
| `npm run seed:fresh` | Wipe previously-seeded data, then re-seed |

## API documentation

Every endpoint — auth, profile, connections, discovery, messages, payments,
GitHub, notifications, plus the health check — is documented as an
interactive OpenAPI 3.0 spec at `/api/docs`. Click **Authorize** in the UI
and paste a JWT access token (from `/auth/login`) to try protected routes
directly from the browser.

Real-time chat (sending messages, typing indicators, presence) happens over
Socket.IO rather than REST — see `src/config/socket.js` for the event
contracts (`message:send`, `typing:start`, `typing:stop`, `user:online`,
`user:offline`).

## Deployment notes

- The app listens for `SIGINT`/`SIGTERM` and shuts down gracefully (closes
  the HTTP server, BullMQ workers, MongoDB, and Redis in order) — important
  for zero-downtime deploys and `docker stop`/container orchestrator restarts.
- `NODE_ENV=production` enables the `combined` Morgan log format and sets
  Express's `trust proxy` to trust exactly one hop, so rate limiting sees
  the real client IP when running behind a single reverse proxy / load
  balancer (adjust the hop count in `src/config/environments/production.js`
  if your setup has more proxies in front of it).
- Response compression (gzip) is enabled in all environments.

See `SLICE_14_DEPLOYMENT_AND_DOCS.md` for the full deployment-readiness
changelog, and the other `SLICE_*.md` files for everything that came before it.
