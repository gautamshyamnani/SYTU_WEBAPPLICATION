const { Queue } = require('bullmq');
const { createBullMQClient, isRedisConfigured } = require('../config/redis');

/**
 * githubSyncQueue
 *
 * Handles background syncing of GitHub repositories for users.
 * Jobs are added by the OAuth callback and by the manual trigger endpoint.
 *
 * Job name : 'syncRepos'
 * Job data : { userId: string }
 *
 * If REDIS_URL isn't set, githubSyncQueue is null — callers adding jobs to
 * this queue must check for null (see controllers that call .add directly)
 * or route through a try/catch, same pattern as utils/queue.js.
 */
const connection = createBullMQClient();

const githubSyncQueue = connection
  ? new Queue('githubSync', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 }, // 5s → 25s → 125s
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      },
    })
  : null;

if (githubSyncQueue) {
  githubSyncQueue.on('error', (err) => {
    console.error('[githubSyncQueue] Queue error:', err.message);
  });
} else if (!isRedisConfigured) {
  console.warn('[githubSyncQueue] REDIS_URL not set — githubSync queue disabled, jobs will be skipped');
}

module.exports = { githubSyncQueue };
