const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Short-lived access token (15 minutes by default).
 * Stateless — verified purely by signature.
 */
const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
};

/**
 * Long-lived refresh token.
 * Stored (hashed) in the DB so it can be explicitly invalidated on logout.
 * The raw token is sent to the client; only the hash lives in Mongo.
 */
const generateRefreshToken = () => {
  // 64 random bytes → hex string (128 chars). Cryptographically strong.
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Hash a refresh token before storing in DB.
 * SHA-256 is fine here — tokens are already random & long.
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Keep legacy name as alias so register() still works without change
const generateToken = generateAccessToken;

module.exports = { generateToken, generateAccessToken, generateRefreshToken, hashToken };
