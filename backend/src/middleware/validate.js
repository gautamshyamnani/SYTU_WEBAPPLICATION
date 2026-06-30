/**
 * validate.js — Input validation middleware
 *
 * Uses express-validator. Each exported validator is an array
 * [validationRules..., handleValidationErrors] that can be spread
 * directly into a router.post('/route', ...validators.register).
 *
 * handleValidationErrors MUST be the last item in every validator array —
 * it reads the accumulated errors and short-circuits with 400 before the
 * controller runs.
 */

const { body, query, param, validationResult } = require('express-validator');

// ─── Error collector (used at the END of every validator chain) ───────────────
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ─── Auth validators ──────────────────────────────────────────────────────────

const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 60 }).withMessage('Name must be 2–60 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),

  handleValidationErrors,
];

const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required'),

  handleValidationErrors,
];

// ─── Profile update validator ─────────────────────────────────────────────────

const validateProfileUpdate = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3–30 characters')
    .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('Username may only contain letters, numbers, _ . -'),

  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Bio must be 500 characters or fewer'),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Location must be 100 characters or fewer'),

  body('skills')
    .optional()
    .isArray({ max: 30 }).withMessage('Skills must be an array of up to 30 items')
    .custom((skills) => {
      if (!skills.every((s) => typeof s === 'string' && s.length <= 50)) {
        throw new Error('Each skill must be a string of 50 characters or fewer');
      }
      return true;
    }),

  body('profilePicture')
    .optional()
    .trim()
    .isURL({ protocols: ['https'], require_protocol: true })
    .withMessage('Profile picture must be a valid HTTPS URL'),

  handleValidationErrors,
];

// ─── Payment validator ────────────────────────────────────────────────────────

const validateCreateOrder = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 1 }).withMessage('Amount must be a positive number')
    .toFloat(),

  body('currency')
    .optional()
    .trim()
    .isIn(['INR', 'USD', 'EUR', 'GBP']).withMessage('Unsupported currency'),

  body('plan')
    .optional()
    .trim()
    .isIn(['monthly', 'annual']).withMessage('Plan must be "monthly" or "annual"'),

  handleValidationErrors,
];

const validateVerifyPayment = [
  body('razorpay_order_id')
    .trim()
    .notEmpty().withMessage('razorpay_order_id is required'),

  body('razorpay_payment_id')
    .trim()
    .notEmpty().withMessage('razorpay_payment_id is required'),

  body('razorpay_signature')
    .trim()
    .notEmpty().withMessage('razorpay_signature is required'),

  handleValidationErrors,
];

// ─── Search validator ─────────────────────────────────────────────────────────

const validateSearch = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Search query must be 100 characters or fewer'),

  query('location')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Location filter must be 100 characters or fewer'),

  query('skills')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Skills filter must be 200 characters or fewer'),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
    .toInt(),

  query('sortBy')
    .optional()
    .trim()
    .isIn(['name', 'createdAt', 'matchScore']).withMessage('sortBy must be name, createdAt, or matchScore'),

  query('order')
    .optional()
    .trim()
    .isIn(['asc', 'desc']).withMessage('order must be asc or desc'),

  query('minMatchScore')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('minMatchScore must be between 0 and 100')
    .toFloat(),

  handleValidationErrors,
];

// ─── MongoDB ObjectId param validator ────────────────────────────────────────
const validateMongoId = (paramName = 'id') => [
  param(paramName)
    .isMongoId().withMessage(`Invalid ${paramName} format`),
  handleValidationErrors,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validateCreateOrder,
  validateVerifyPayment,
  validateSearch,
  validateMongoId,
  handleValidationErrors,
};
