const express = require('express');
const router = express.Router();
const { getChatHistory } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

// GET /api/messages/:userId — fetch conversation history
router.get('/:userId', protect, getChatHistory);

module.exports = router;
