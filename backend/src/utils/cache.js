const { getRedisClient } = require('../config/redis');

const DEFAULT_TTL = 60; // seconds

/**
 * Build a namespaced cache key.
 * e.g. cacheKey('discovery', userId) → "discovery:<userId>"
 */
const cacheKey = (namespace, ...parts) => `${namespace}:${parts.join(':')}`;

/**
 * Read a value from Redis.
 * Returns the parsed value on HIT, null on MISS, Redis failure, or when
 * Redis isn't configured at all (REDIS_URL unset).
 */
const getCache = async (key) => {
  const client = getRedisClient();
  if (!client) return null; // Redis disabled — treat every read as a miss
  try {
    const raw = await client.get(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[Cache] GET failed for "${key}":`, err.message);
    return null; // treat as cache miss — fallback to DB
  }
};

/**
 * Write a value to Redis with a TTL (default 60 s).
 * Silently no-ops if Redis isn't configured or unreachable — the response
 * still goes out either way.
 */
const setCache = async (key, value, ttl = DEFAULT_TTL) => {
  const client = getRedisClient();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    console.error(`[Cache] SET failed for "${key}":`, err.message);
  }
};

/**
 * Delete one or more keys from Redis.
 * Silently no-ops if Redis isn't configured or unreachable.
 */
const deleteCache = async (...keys) => {
  if (!keys.length) return;
  const client = getRedisClient();
  if (!client) return;
  try {
    await client.del(...keys);
  } catch (err) {
    console.error(`[Cache] DEL failed for [${keys.join(', ')}]:`, err.message);
  }
};

module.exports = { cacheKey, getCache, setCache, deleteCache };
