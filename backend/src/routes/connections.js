const express = require('express');
const router = express.Router();
const {
  sendRequest,
  respondToRequest,
  getPendingRequests,
  getConnections,
} = require('../controllers/connectionController');
const { protect } = require('../middleware/auth');

// All connection routes are protected
router.post('/send/:userId', protect, sendRequest);
router.put('/respond/:requestId', protect, respondToRequest);
router.get('/requests', protect, getPendingRequests);
router.get('/list', protect, getConnections);

module.exports = router;
