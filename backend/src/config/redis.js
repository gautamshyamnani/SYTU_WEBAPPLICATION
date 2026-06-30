const Redis = require('ioredis');

// ─── Shared Redis options ────────────────────────────────────────────────────
// Used by: cache helpers, Socket.IO adapter, BullMQ queues/workers.
// BullMQ requires maxRetriesPerRequest: null (it manages its own retry logic).

// REDIS_URL (e.g. redis://:password@host:port or rediss://... for TLS) is
// what Render's managed Redis / Upstash / Redis Cloud give you. Render
// containers cannot reach 127.0.0.1 for Redis — that's the app container's
// own loopback, not the Redis service — so REDIS_URL must take priority.
const REDIS_URL = process.env.REDIS_URL;

const baseOptions = REDIS_URL
  ? {}
  : {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    };

const retryStrategy = (times) => {
  if (times > 5) {
    console.error('[Redis] Too many failed reconnect attempts — giving up');
    return null;
  }
  return Math.min(times * 200, 2000); // exponential back-off up to 2 s
};

const makeClient = (extraOptions) =>
  REDIS_URL
    ? new Redis(REDIS_URL, { retryStrategy, ...extraOptions })
    : new Redis({ ...baseOptions, retryStrategy, ...extraOptions });

// ─── Cache client (singleton) ────────────────────────────────────────────────
// Used by get/set/delete cache helpers. maxRetriesPerRequest: 3 so a
// Redis outage fails fast and falls back to DB.
let cacheClient = null;

const getRedisClient = () => {
  if (cacheClient) return cacheClient;
  cacheClient = makeClient({ maxRetriesPerRequest: 3 });
  attachLogs(cacheClient, 'Cache');
  return cacheClient;
};

// ─── BullMQ client factory ───────────────────────────────────────────────────
// BullMQ mandates maxRetriesPerRequest: null (it handles blocking commands
// like XREAD internally). Call this to get a fresh client per queue/worker.
const createBullMQClient = () => {
  const client = makeClient({ maxRetriesPerRequest: null });
  attachLogs(client, 'BullMQ');
  return client;
};

// ─── Pub/Sub client factory (Socket.IO Redis adapter) ───────────────────────
// The adapter needs two dedicated connections — one for publish, one for
// subscribe — so we always create new instances here (no singleton).
const createPubSubClient = () => {
  const client = makeClient({ maxRetriesPerRequest: 3 });
  attachLogs(client, 'PubSub');
  return client;
};

// ─── Internal helper ─────────────────────────────────────────────────────────
const attachLogs = (client, label) => {
  client.on('connect', () => console.log(`[Redis:${label}] Connected`));
  client.on('ready',   () => console.log(`[Redis:${label}] Ready`));
  client.on('error',   (err) => console.error(`[Redis:${label}] Error:`, err.message));
  client.on('close',   () => console.warn(`[Redis:${label}] Connection closed`));
};

module.exports = { getRedisClient, createBullMQClient, createPubSubClient };
