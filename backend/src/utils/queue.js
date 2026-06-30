const { emailQueue } = require('../queues/email.queue');
const { notificationQueue } = require('../queues/notification.queue');

// ─── Email jobs ───────────────────────────────────────────────────────────────

/**
 * addEmailJob(type, data, opts?)
 *
 * @param {string} type  - Job name / type. e.g. 'welcome', 'password_reset'
 * @param {Object} data  - Payload passed to the worker
 * @param {Object} [opts] - BullMQ job options override (e.g. { delay: 5000 })
 *
 * Examples:
 *   addEmailJob('welcome', { userId, name, email })
 *   addEmailJob('password_reset', { email, resetLink }, { delay: 0 })
 */
const addEmailJob = async (type, data, opts = {}) => {
  try {
    const job = await emailQueue.add(type, data, opts);
    console.log(`[Queue:email] Added job "${type}" — id: ${job.id}`);
    return job;
  } catch (err) {
    // Queue failures must never crash the request that triggered them
    console.error(`[Queue:email] Failed to add job "${type}":`, err.message);
    return null;
  }
};

// ─── Notification jobs ────────────────────────────────────────────────────────

/**
 * addNotificationJob(type, data, opts?)
 *
 * @param {string} type  - e.g. 'connection_request', 'connection_accepted'
 * @param {Object} data  - Payload passed to the worker
 * @param {Object} [opts] - BullMQ job options override
 */
const addNotificationJob = async (type, data, opts = {}) => {
  try {
    const job = await notificationQueue.add(type, data, opts);
    console.log(`[Queue:notification] Added job "${type}" — id: ${job.id}`);
    return job;
  } catch (err) {
    console.error(`[Queue:notification] Failed to add job "${type}":`, err.message);
    return null;
  }
};

module.exports = { addEmailJob, addNotificationJob };
