const Redis = require('ioredis');

// ─── Shared Redis client factory ─────────────────────────────────────────────
// Used by: cache helpers, Socket.IO adapter, BullMQ queues/workers.
//
// ROOT CAUSE OF "ECONNREFUSED 127.0.0.1:6379" ON RENDER:
// A previous version of this file fell back to host/port localhost defaults
// when REDIS_URL was missing. That fallback has been removed entirely.
// This file now ONLY reads REDIS_URL. There is NO localhost/127.0.0.1
// default anywhere in this codebase anymore.
//
// REDIS_URL must be a full connection string, e.g.:
//   redis://default:<password>@<host>:<port>          (no TLS)
//   rediss://default:<password>@<host>:<port>          (TLS — most managed Redis)
//
// If REDIS_URL is not set, Redis is treated as OPTIONAL: every factory below
// returns null instead of throwing, and callers (cache.js, queues, workers,
// socket.js) are responsible for handling a null connection gracefully so
// the app never crashes just because Redis is unavailable.

const REDIS_URL = process.env.REDIS_URL;
const isRedisConfigured = Boolean(REDIS_URL);

if (!isRedisConfigured) {
  console.warn(
    '[Redis] REDIS_URL is not set — Redis is disabled. ' +
    'Cache, rate-limit-by-Redis, BullMQ queues/workers, and the Socket.IO ' +
    'Redis adapter will all no-op instead of connecting. ' +
    'Set REDIS_URL in Render → Environment to enable them.'
  );
}

const retryStrategy = (times) => {
  if (times > 5) {
    console.error('[Redis] Too many failed reconnect attempts — giving up');
    return null;
  }
  return Math.min(times * 200, 2000); // exponential back-off up to 2 s
};

const attachLogs = (client, label) => {
  client.on('connect', () => console.log(`[Redis:${label}] Connected`));
  client.on('ready',   () => console.log(`[Redis:${label}] Ready`));
  client.on('error',   (err) => console.error(`[Redis:${label}] Error:`, err.message));
  client.on('close',   () => console.warn(`[Redis:${label}] Connection closed`));
};

// Creates a new ioredis client from REDIS_URL, or returns null if Redis
// isn't configured. No host/port/localhost path exists here at all.
const makeClient = (extraOptions, label) => {
  if (!isRedisConfigured) return null;
  const client = new Redis(REDIS_URL, { retryStrategy, ...extraOptions });
  attachLogs(client, label);
  return client;
};

// ─── Cache client (singleton) ────────────────────────────────────────────────
// maxRetriesPerRequest: 3 so a Redis outage fails fast and callers fall back
// to the database instead of hanging.
let cacheClient;
let cacheClientInitialized = false;

const getRedisClient = () => {
  if (cacheClientInitialized) return cacheClient;
  cacheClientInitialized = true;
  cacheClient = makeClient({ maxRetriesPerRequest: 3 }, 'Cache');
  return cacheClient; // may be null if Redis isn't configured
};

// ─── BullMQ client factory ───────────────────────────────────────────────────
// BullMQ MANDATES maxRetriesPerRequest: null — it manages blocking commands
// (e.g. BZPOPMIN) and retry logic itself. A fresh client per queue/worker.
const createBullMQClient = () => makeClient({ maxRetriesPerRequest: null }, 'BullMQ');

// ─── Pub/Sub client factory (Socket.IO Redis adapter) ───────────────────────
// Needs two dedicated connections (pub + sub) — never share with cache/BullMQ.
const createPubSubClient = () => makeClient({ maxRetriesPerRequest: 3 }, 'PubSub');

module.exports = {
  getRedisClient,
  createBullMQClient,
  createPubSubClient,
  isRedisConfigured,
};
