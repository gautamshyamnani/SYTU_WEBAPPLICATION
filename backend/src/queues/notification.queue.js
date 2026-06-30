const { Queue } = require('bullmq');
const { createBullMQClient, isRedisConfigured } = require('../config/redis');

/**
 * notificationQueue — placeholder for in-app / push notifications.
 *
 * Job types expected (add handlers in notification.worker.js as needed):
 *   - 'connection_request'  → notify user of a new request
 *   - 'connection_accepted' → notify sender their request was accepted
 *   - 'new_message'         → push notification for offline users
 *
 * If REDIS_URL isn't set, notificationQueue is null and addNotificationJob()
 * (in utils/queue.js) detects that and no-ops instead of crashing.
 */
const connection = createBullMQClient();

const notificationQueue = connection
  ? new Queue('notification', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    })
  : null;

if (notificationQueue) {
  notificationQueue.on('error', (err) => {
    console.error('[notificationQueue] Queue error:', err.message);
  });
} else if (!isRedisConfigured) {
  console.warn('[notificationQueue] REDIS_URL not set — notification queue disabled, jobs will be skipped');
}

module.exports = { notificationQueue };
