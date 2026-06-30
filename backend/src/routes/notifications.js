const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notificationController');

// All routes require a valid JWT
router.use(protect);

/**
 * GET /api/notifications
 * Returns the user's notifications, newest first.
 * Query params:
 *   ?page=1          — page number (default 1)
 *   ?limit=20        — results per page (max 100, default 20)
 *   ?unreadOnly=true — return only unread notifications
 *
 * Response also includes `unreadCount` (total unread, regardless of filter).
 */
router.get('/', getNotifications);

/**
 * PUT /api/notifications/read-all
 * Marks ALL unread notifications for the current user as read.
 * Must be declared BEFORE /:id to avoid "read-all" being treated as an ID.
 */
router.put('/read-all', markAllAsRead);

/**
 * PUT /api/notifications/:id/read
 * Marks a single notification as read. Ownership-checked.
 */
router.put('/:id/read', markAsRead);

/**
 * DELETE /api/notifications/:id
 * Deletes a single notification. Ownership-checked.
 */
router.delete('/:id', deleteNotification);

module.exports = router;
