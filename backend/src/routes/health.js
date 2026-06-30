const express = require('express');
const router  = express.Router();
const { getHealth } = require('../controllers/healthController');

/**
 * GET /api/health
 * Returns { status, uptime, timestamp } plus a quick Mongo/Redis connectivity
 * check. Used by Docker HEALTHCHECK, load balancers, and uptime monitors.
 * Intentionally NOT behind `protect` — must be reachable with no auth.
 */
router.get('/', getHealth);

module.exports = router;
