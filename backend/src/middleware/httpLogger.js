/**
 * httpLogger.js — Morgan HTTP request logging middleware
 *
 * Streams Morgan output into Winston so all logs go to the same
 * transports (console + files).
 *
 * Format:
 *   dev  — coloured, concise  (development)
 *   combined — Apache combined log format (production)
 *
 * Skips /health polling so uptime monitors don't flood the logs.
 */

const morgan = require('morgan');
const logger = require('../config/logger');
const config = require('../config');

// Morgan → Winston stream bridge
const stream = {
  write: (message) => logger.http(message.trim()),
};

// Skip health-check polls
const skip = (req) => req.path === '/health' || req.path === '/api/health';

const httpLogger = morgan(config.morganFormat, { stream, skip });

module.exports = httpLogger;
