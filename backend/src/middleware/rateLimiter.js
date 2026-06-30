/**
 * rateLimiter.js — Rate limiting middleware
 *
 * Two layers:
 *
 *  1. globalLimiter      — broad abuse protection on every route
 *                          100 req / 15 min / IP
 *
 *  2. authLimiter        — strict limit on login + register
 *                          10 req / 15 min / IP
 *                          Slows down credential-stuffing attacks.
 *
 *  3. createRateLimiter  — Redis-backed per-user limiter (retained from
 *                          Slice 12 for the search endpoint).
 *
 * express-rate-limit is used for layers 1 & 2: battle-tested, handles the
 * standard RateLimit-* headers automatically, in-memory store is fine for
 * IP-scoped global / auth limiters. The per-user search limiter keeps Redis
 * so counts stay consistent across multiple instances.
 */

const rateLimit = require('express-rate-limit');
const { getRedisClient } = require('../config/redis');

// ─── 1. Global limiter — applied to ALL routes in app.js ─────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // per IP
  standardHeaders: true,     // Return RateLimit-* headers (RFC 6585)
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests — please slow down and try again later.',
    });
  },
  skip: (req) => req.path === '/health' || req.path === '/api/health',
});

// ─── 2. Auth limiter — /login and /register only ─────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts — please wait 15 minutes before trying again.',
    });
  },
});

// ─── 3. Redis-backed per-user limiter (search endpoint) ──────────────────────
const createRateLimiter = ({ windowSec = 60, max = 30, namespace = 'default' } = {}) => {
  return async (req, res, next) => {
    try {
      const identifier  = req.user?._id?.toString() || req.ip;
      const windowStart = Math.floor(Date.now() / 1000 / windowSec);
      const key         = `ratelimit:${namespace}:${identifier}:${windowStart}`;

      const redis = getRedisClient();
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSec);
      }

      if (count > max) {
        return res.status(429).json({
          success: false,
          message: `Too many requests — limit is ${max} per ${windowSec}s. Please slow down.`,
        });
      }

      next();
    } catch (err) {
      console.error('[rateLimiter] Redis error, failing open:', err.message);
      next();
    }
  };
};

module.exports = { globalLimiter, authLimiter, createRateLimiter };
