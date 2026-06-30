const express = require('express');
const router  = express.Router();
const {
  redirectToGitHub,
  handleGitHubCallback,
} = require('../controllers/githubAuthController');

/**
 * GET /api/auth/github
 * Redirects the browser to GitHub's OAuth authorization page.
 * Sets a short-lived CSRF state cookie before redirecting.
 */
router.get('/github', redirectToGitHub);

/**
 * GET /api/auth/github/callback
 * GitHub redirects here after user grants (or denies) access.
 * Exchanges code for token, finds/creates user, issues JWT.
 */
router.get('/github/callback', handleGitHubCallback);

module.exports = router;
