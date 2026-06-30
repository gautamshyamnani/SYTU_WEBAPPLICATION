const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/auth');
const {
  getRepos,
  triggerSync,
  getGitHubStatus,
} = require('../controllers/githubRepoController');

/**
 * All routes below require a valid JWT (protect middleware).
 * The user must have a linked GitHub account (checked in each controller).
 */

/**
 * GET /api/github/status
 * Returns GitHub connection status: linked or not, username, repo count, last sync.
 */
router.get('/status', protect, getGitHubStatus);

/**
 * GET /api/github/repos
 * Returns paginated repos from DB (previously synced).
 * Query params:
 *   ?fresh=true   — inline re-sync before responding (slower but always fresh)
 *   ?page=1       — page number
 *   ?limit=20     — results per page (max 100)
 *   ?sort=stars   — stars | forks | updated | name
 *   ?lang=Go      — filter by programming language
 */
router.get('/repos', protect, getRepos);

/**
 * POST /api/github/sync
 * Enqueues a background repo sync job. Returns 202 Accepted immediately.
 * Use GET /api/github/repos after a moment to see updated results.
 */
router.post('/sync', protect, triggerSync);

module.exports = router;
