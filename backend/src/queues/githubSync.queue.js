const { Queue } = require('bullmq');
const { createBullMQClient } = require('../config/redis');

/**
 * githubSyncQueue
 *
 * Handles background syncing of GitHub repositories for users.
 * Jobs are added by the OAuth callback and by the manual trigger endpoint.
 *
 * Job name : 'syncRepos'
 * Job data : { userId: string }
 */
const githubSyncQueue = new Queue('githubSync', {
  connection: createBullMQClient(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s → 25s → 125s
    },
    removeOnComplete: { count: 50 },
    removeOnFail:     { count: 100 },
  },
});

githubSyncQueue.on('error', (err) => {
  console.error('[githubSyncQueue] Queue error:', err.message);
});

module.exports = { githubSyncQueue };
