/**
 * errorHandler.js — Central error handling middleware
 *
 * Placed LAST in app.js (after all routes).
 * Catches errors passed via next(err) from any controller or middleware.
 *
 * Standard error response shape:
 *   { success: false, message: string, errors?: array, stack?: string }
 *
 * stack is only included in NODE_ENV=development so we never leak internals.
 */

const logger = require('../config/logger');

// ─── Operational error types we know how to handle ───────────────────────────

function handleMongooseError(err) {
  // Duplicate key (e.g. email or username already exists)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return {
      statusCode: 409,
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} already in use`,
    };
  }

  // Validation error (schema-level)
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return {
      statusCode: 400,
      message: messages.join(', '),
    };
  }

  // Cast error — bad ObjectId format
  if (err.name === 'CastError') {
    return {
      statusCode: 400,
      message: `Invalid value for field "${err.path}"`,
    };
  }

  return null;
}

function handleJWTError(err) {
  if (err.name === 'JsonWebTokenError') {
    return { statusCode: 401, message: 'Invalid token — please log in again' };
  }
  if (err.name === 'TokenExpiredError') {
    return { statusCode: 401, message: 'Token expired — please log in again' };
  }
  return null;
}

// ─── 404 handler (not an error — just unknown routes) ────────────────────────
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

// ─── Central error handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Log the full error internally
  logger.error(err.message, {
    path: req.originalUrl,
    method: req.method,
    stack: err.stack,
    code: err.code,
  });

  // Determine status code — respect err.statusCode if already set
  let statusCode = err.statusCode || err.status || 500;
  let message    = err.message || 'Internal server error';
  let errors     = undefined;

  // ── Classify known error types ──
  const mongooseResult = handleMongooseError(err);
  if (mongooseResult) {
    statusCode = mongooseResult.statusCode;
    message    = mongooseResult.message;
  }

  const jwtResult = handleJWTError(err);
  if (jwtResult) {
    statusCode = jwtResult.statusCode;
    message    = jwtResult.message;
  }

  // express-validator errors forwarded via next(err) (rare — usually handled inline)
  if (err.type === 'validation' && Array.isArray(err.errors)) {
    statusCode = 400;
    message    = 'Validation failed';
    errors     = err.errors;
  }

  // CORS errors (from cors middleware)
  if (err.message && err.message.startsWith('CORS:')) {
    statusCode = 403;
    message    = err.message;
  }

  const body = { success: false, message };
  if (errors) body.errors = errors;

  // Only expose stack trace in development
  if (process.env.NODE_ENV === 'development') {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
};

module.exports = { notFoundHandler, errorHandler };
