/**
 * logger.js — Application-wide Winston logger
 *
 * Two transports:
 *   • Console  — human-readable coloured output (dev) / JSON (prod)
 *   • File     — JSON lines written to logs/ directory
 *       - logs/error.log  : ERROR level only
 *       - logs/combined.log : everything INFO and above
 *
 * Usage anywhere in the app:
 *   const logger = require('../config/logger');
 *   logger.info('Payment created', { orderId });
 *   logger.error('DB connection failed', { err: err.message });
 */

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs/ directory exists (won't throw if it already exists)
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const isDev = process.env.NODE_ENV !== 'production';

// ─── Format helpers ──────────────────────────────────────────────────────────

const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'HH:mm:ss' }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

const fileFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
);

// ─── Logger instance ─────────────────────────────────────────────────────────

const logger = createLogger({
  level: isDev ? 'debug' : 'info',
  defaultMeta: { service: 'auth-backend' },
  transports: [
    // Console — always on
    new transports.Console({ format: consoleFormat }),

    // File — errors only
    new transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5 * 1024 * 1024,  // 5 MB
      maxFiles: 5,
    }),

    // File — combined (INFO and above)
    new transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
    }),
  ],
});

module.exports = logger;
