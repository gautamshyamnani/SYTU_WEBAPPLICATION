const express = require('express');
const router  = express.Router();
const { getMe, updateProfile } = require('../controllers/userController');
const { searchUsers }          = require('../controllers/searchController');
const { protect }              = require('../middleware/auth');
const { createRateLimiter }    = require('../middleware/rateLimiter');
const { validateProfileUpdate, validateSearch } = require('../middleware/validate');

const searchRateLimiter = createRateLimiter({ windowSec: 60, max: 30, namespace: 'user-search' });

router.get('/me',     protect, getMe);
router.put('/update', protect, validateProfileUpdate, updateProfile);

// Mounted at both /api/user/search and /api/users/search (see app.js)
router.get('/search', protect, searchRateLimiter, validateSearch, searchUsers);

module.exports = router;
