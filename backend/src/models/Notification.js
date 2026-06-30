const mongoose = require('mongoose');

/**
 * Notification — stores in-app notifications for users.
 *
 * Every notification is persisted regardless of whether the user is
 * online at the time of delivery (so they see it when they next connect).
 *
 * Real-time delivery is handled by the notification worker via Socket.IO.
 */
const notificationSchema = new mongoose.Schema(
  {
    // The user who receives this notification
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Notification category — drives icon/copy on the client
    type: {
      type: String,
      required: true,
      enum: ['connection_request', 'connection_accepted', 'message', 'payment', 'system'],
    },

    // Human-readable message displayed in the notification centre
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: [300, 'Notification message too long'],
    },

    // Optional: link the notification to a specific resource
    // e.g. connectionId, messageId, paymentId — stored as a string to stay model-agnostic
    referenceId: {
      type: String,
      default: null,
    },

    // Whether the user has read/acknowledged this notification
    isRead: {
      type: Boolean,
      default: false,
      index: true,        // fast unread-count queries
    },
  },
  {
    timestamps: true,      // createdAt, updatedAt managed by Mongoose
  }
);

// ─── Compound index ───────────────────────────────────────────────────────────
// Most common query: "give me all notifications for user X, latest first"
notificationSchema.index({ userId: 1, createdAt: -1 });

// Unread count query: "how many unread for user X?"
notificationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
