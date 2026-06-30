const express = require('express');
const router = express.Router();
const { discoverUsers } = require('../controllers/discoveryController');
const { protect } = require('../middleware/auth');

router.get('/', protect, discoverUsers);

module.exports = router;
