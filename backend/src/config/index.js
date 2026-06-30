/**
 * config/index.js — Environment-aware config loader
 *
 * Usage:
 *   const config = require('./config');
 *   console.log(config.env, config.logLevel);
 *
 * Picks src/config/environments/{development,production}.js based on
 * process.env.NODE_ENV (defaults to 'development'). Falls back to the
 * development config for any unrecognised NODE_ENV value rather than
 * crashing, since this only controls non-critical behavioural knobs
 * (log verbosity, Morgan format, trust proxy) — never secrets.
 */

const development = require('./environments/development');
const production   = require('./environments/production');

const ENVIRONMENTS = { development, production };

const NODE_ENV = process.env.NODE_ENV || 'development';

const config = ENVIRONMENTS[NODE_ENV] || development;

module.exports = config;
