const express = require('express');
const router  = express.Router();
const { createOrder, verifyPayment, handleWebhook } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { validateCreateOrder, validateVerifyPayment } = require('../middleware/validate');

// User-initiated, JWT-protected
router.post('/create-order', protect, validateCreateOrder, createOrder);
router.post('/verify',       protect, validateVerifyPayment, verifyPayment);

// Razorpay webhook — NOT behind protect.
// Authenticity is established via X-Razorpay-Signature header (see controller).
// Raw body parsing for this route is registered in app.js (before express.json).
router.post('/webhook', handleWebhook);

module.exports = router;
