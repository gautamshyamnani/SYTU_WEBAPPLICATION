const express = require('express');
const router  = express.Router();
const { register, login, refresh, logout } = require('../controllers/authController');
const { protect }         = require('../middleware/auth');
const { authLimiter }     = require('../middleware/rateLimiter');
const { validateRegister, validateLogin } = require('../middleware/validate');

// Strict rate limit on auth endpoints to slow credential-stuffing
router.post('/register', authLimiter, validateRegister, register);
router.post('/login',    authLimiter, validateLogin,    login);
router.post('/refresh',  refresh);
router.post('/logout',   protect, logout);

module.exports = router;
