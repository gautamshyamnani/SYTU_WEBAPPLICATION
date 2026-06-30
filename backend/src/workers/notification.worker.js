const { Worker } = require('bullmq');
const { createBullMQClient } = require('../config/redis');
const Notification = require('../models/Notification');
const { getSocketId } = require('../utils/presenceStore');

/**
 * notification.worker — processes jobs from the 'notification' queue.
 *
 * Each job:
 *   1. Persists a Notification document to MongoDB
 *      (ensures offline users still see it when they reconnect)
 *   2. If the target user is currently online, emits 'notification:new'
 *      directly to their socket via the io singleton
 *
 * Expected job data shape (all job types share this):
 *   {
 *     userId:      string   — recipient's MongoDB user ID
 *     type:        string   — 'connection_request' | 'connection_accepted' | 'message' | 'payment' | 'system'
 *     message:     string   — human-readable notification text
 *     referenceId: string?  — related resource ID (connectionId, messageId, paymentId)
 *   }
 *
 * Supported job names (must match what addNotificationJob() is called with):
 *   'connection_request' | 'connection_accepted' | 'message' | 'payment' | 'system'
 */

// ─── Main processor ───────────────────────────────────────────────────────────

const processNotification = async (job) => {
  const { userId, type, message, referenceId } = job.data;

  // ── Validate required fields ──────────────────────────────────────────────
  if (!userId || !type || !message) {
    console.warn(
      `[NotificationWorker] Job ${job.id} missing required fields — skipping`,
      job.data
    );
    return { skipped: true, reason: 'missing_fields' };
  }

  // ── 1. Persist to MongoDB ─────────────────────────────────────────────────
  // Always save — user may be offline now but will query on reconnect.
  let notification;
  try {
    notification = await Notification.create({
      userId,
      type,
      message,
      referenceId: referenceId || null,
    });
    console.log(
      `[NotificationWorker] Saved notification ${notification._id} ` +
      `for user ${userId} (type: ${type})`
    );
  } catch (err) {
    // If duplicate key or validation error — log and bail, don't retry
    if (err.name === 'ValidationError') {
      console.error(`[NotificationWorker] Validation error for job ${job.id}:`, err.message);
      return { skipped: true, reason: 'validation_error' };
    }
    throw err; // unknown error — let BullMQ retry
  }

  // ── 2. Real-time delivery via Socket.IO ───────────────────────────────────
  // getIO() returns the io singleton; if the server hasn't fully started yet,
  // we catch and continue — the notification is already in the DB.
  try {
    const { getIO } = require('../config/socket');
    const io = getIO();

    const socketId = getSocketId(userId);

    if (socketId) {
      io.to(socketId).emit('notification:new', {
        id:          notification._id,
        type:        notification.type,
        message:     notification.message,
        referenceId: notification.referenceId,
        isRead:      false,
        createdAt:   notification.createdAt,
      });
      console.log(
        `[NotificationWorker] Emitted 'notification:new' to user ${userId} ` +
        `(socketId: ${socketId})`
      );
    } else {
      // User is offline — notification is stored; they'll fetch on reconnect
      console.log(
        `[NotificationWorker] User ${userId} offline — notification stored, will deliver on reconnect`
      );
    }
  } catch (err) {
    // Socket delivery failure must never fail the job — DB record is the source of truth
    console.error(
      `[NotificationWorker] Socket delivery failed for user ${userId}:`,
      err.message
    );
  }

  return {
    notificationId: notification._id.toString(),
    userId,
    type,
    delivered: !!getSocketId(userId),
  };
};

// ─── Worker setup ─────────────────────────────────────────────────────────────

const notificationWorker = new Worker(
  'notification',
  async (job) => {
    console.log(
      `[NotificationWorker] Processing job "${job.name}" (id: ${job.id}) ` +
      `for user: ${job.data.userId}`
    );
    return processNotification(job);
  },
  {
    connection: createBullMQClient(),
    concurrency: 20, // notifications are lightweight DB writes + socket emits
  }
);

// ─── Worker lifecycle hooks ───────────────────────────────────────────────────

notificationWorker.on('completed', (job, result) => {
  console.log(
    `[NotificationWorker] ✓ Job "${job.name}" (${job.id}) completed:`,
    result
  );
});

notificationWorker.on('failed', (job, err) => {
  console.error(
    `[NotificationWorker] ✗ Job "${job?.name}" (${job?.id}) failed ` +
    `(attempt ${job?.attemptsMade}/${job?.opts?.attempts ?? '?'}):`,
    err.message
  );
});

notificationWorker.on('error', (err) => {
  console.error('[NotificationWorker] Worker error:', err.message);
});

module.exports = { notificationWorker };
