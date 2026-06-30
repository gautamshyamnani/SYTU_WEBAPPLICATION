const { Queue } = require('bullmq');
const { createBullMQClient, isRedisConfigured } = require('../config/redis');

/**
 * emailQueue — handles async email jobs.
 *
 * If REDIS_URL isn't set, `connection` is null and we skip creating the
 * BullMQ Queue entirely — emailQueue stays null and addEmailJob() (in
 * utils/queue.js) detects that and no-ops instead of crashing.
 *
 * Default job options applied to every job added through this queue:
 *   attempts: 3   — retry up to 3 times on failure
 *   backoff:      — exponential back-off between retries (1 s, 2 s, 4 s)
 *   removeOnComplete: { count: 100 } — keep the last 100 completed jobs
 *   removeOnFail:    { count: 200 } — keep the last 200 failed jobs
 */
const connection = createBullMQClient();

const emailQueue = connection
  ? new Queue('email', {
      connection, // maxRetriesPerRequest: null is set inside createBullMQClient()
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    })
  : null;

if (emailQueue) {
  emailQueue.on('error', (err) => {
    console.error('[emailQueue] Queue error:', err.message);
  });
} else if (!isRedisConfigured) {
  console.warn('[emailQueue] REDIS_URL not set — email queue disabled, jobs will be skipped');
}

module.exports = { emailQueue };
