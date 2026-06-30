const { Queue } = require('bullmq');
const { createBullMQClient } = require('../config/redis');

/**
 * emailQueue — handles async email jobs.
 *
 * Default job options applied to every job added through this queue:
 *   attempts: 3   — retry up to 3 times on failure
 *   backoff:      — exponential back-off between retries (1 s, 2 s, 4 s)
 *   removeOnComplete: { count: 100 } — keep the last 100 completed jobs for inspection
 *   removeOnFail:    { count: 200 } — keep the last 200 failed jobs for debugging
 */
const emailQueue = new Queue('email', {
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

emailQueue.on('error', (err) => {
  console.error('[emailQueue] Queue error:', err.message);
});

module.exports = { emailQueue };
