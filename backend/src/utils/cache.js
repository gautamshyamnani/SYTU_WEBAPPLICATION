const { getRedisClient } = require('../config/redis');

const DEFAULT_TTL = 60; // seconds

/**
 * Build a namespaced cache key.
 * e.g. cacheKey('discovery', userId) → "discovery:<userId>"
 */
const cacheKey = (namespace, ...parts) => `${namespace}:${parts.join(':')}`;

/**
 * Read a value from Redis.
 * Returns the parsed value on HIT, null on MISS or Redis failure.
 */
const getCache = async (key) => {
  try {
    const raw = await getRedisClient().get(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[Cache] GET failed for "${key}":`, err.message);
    return null; // treat as cache miss — fallback to DB
  }
};

/**
 * Write a value to Redis with a TTL (default 60 s).
 * Silently swallowed on Redis failure — the response still goes out.
 */
const setCache = async (key, value, ttl = DEFAULT_TTL) => {
  try {
    await getRedisClient().set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    console.error(`[Cache] SET failed for "${key}":`, err.message);
  }
};

/**
 * Delete one or more keys from Redis.
 * Silently swallowed on Redis failure.
 */
const deleteCache = async (...keys) => {
  if (!keys.length) return;
  try {
    await getRedisClient().del(...keys);
  } catch (err) {
    console.error(`[Cache] DEL failed for [${keys.join(', ')}]:`, err.message);
  }
};

module.exports = { cacheKey, getCache, setCache, deleteCache };
