const mongoose = require('mongoose');
const Notification = require('../models/Notification');

// ─── GET /api/notifications ───────────────────────────────────────────────────

// @desc    Get all notifications for the logged-in user, latest first
// @route   GET /api/notifications
// @access  Private
// @query   ?page=1  ?limit=20  ?unreadOnly=true
const getNotifications = async (req, res) => {
  try {
    const userId   = req.user._id;
    const page     = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit    = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const unreadOnly = req.query.unreadOnly === 'true';

    const filter = { userId };
    if (unreadOnly) filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-__v')
        .lean(),
      Notification.countDocuments(filter),
      // Always return the total unread count regardless of the unreadOnly filter
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    res.status(200).json({
      success: true,
      unreadCount,
      total,
      page,
      pages: Math.ceil(total / limit),
      notifications,
    });
  } catch (err) {
    console.error('[getNotifications]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── PUT /api/notifications/:id/read ─────────────────────────────────────────

// @desc    Mark a single notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id:    id,
        userId: req.user._id, // ownership check — users can only mark their own
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification,
    });
  } catch (err) {
    console.error('[markAsRead]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── PUT /api/notifications/read-all ─────────────────────────────────────────

// @desc    Mark ALL unread notifications for the logged-in user as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      updatedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error('[markAllAsRead]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── DELETE /api/notifications/:id ───────────────────────────────────────────

// @desc    Delete a single notification (ownership-checked)
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });
    }

    const notification = await Notification.findOneAndDelete({
      _id:    id,
      userId: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (err) {
    console.error('[deleteNotification]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, deleteNotification };
