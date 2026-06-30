const { Queue } = require('bullmq');
const { createBullMQClient } = require('../config/redis');

/**
 * notificationQueue — placeholder for in-app / push notifications.
 *
 * Job types expected (add handlers in notification.worker.js as needed):
 *   - 'connection_request'  → notify user of a new request
 *   - 'connection_accepted' → notify sender their request was accepted
 *   - 'new_message'         → push notification for offline users
 */
const notificationQueue = new Queue('notification', {
  connection: createBullMQClient(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

notificationQueue.on('error', (err) => {
  console.error('[notificationQueue] Queue error:', err.message);
});

module.exports = { notificationQueue };
