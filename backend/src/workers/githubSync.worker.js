const { Worker } = require('bullmq');
const { createBullMQClient } = require('../config/redis');
const User = require('../models/User');
const Repo = require('../models/Repo');
const { fetchGitHubRepos, decryptToken, RateLimitError } = require('../config/github');

/**
 * githubSync Worker
 *
 * Processes 'syncRepos' jobs from the githubSync queue.
 *
 * Each job receives: { userId }
 *
 * Steps:
 *   1. Load user + encrypted GitHub access token
 *   2. Decrypt token
 *   3. Fetch all repos from GitHub API
 *   4. Upsert repos into MongoDB (idempotent)
 *   5. Handle rate limits / revoked tokens gracefully
 */
const githubSyncWorker = new Worker(
  'githubSync',
  async (job) => {
    const { userId } = job.data;

    console.log(`[githubSync:worker] Starting sync for user ${userId} — job ${job.id}`);

    // ── 1. Load user with encrypted access token ────────────────────────────
    const user = await User.findById(userId).select('+githubAccessToken');

    if (!user) {
      // User deleted — discard job silently
      console.warn(`[githubSync:worker] User ${userId} not found — skipping`);
      return { skipped: true, reason: 'user_not_found' };
    }

    if (!user.githubId || !user.githubAccessToken) {
      console.warn(`[githubSync:worker] User ${userId} has no GitHub token — skipping`);
      return { skipped: true, reason: 'no_github_token' };
    }

    // ── 2. Decrypt token ────────────────────────────────────────────────────
    const accessToken = decryptToken(user.githubAccessToken);
    if (!accessToken) {
      console.error(`[githubSync:worker] Failed to decrypt token for user ${userId}`);
      // Corrupted / key-rotated — clear the bad token so user knows to re-auth
      await User.findByIdAndUpdate(userId, { $unset: { githubAccessToken: '' } });
      return { skipped: true, reason: 'decrypt_failed' };
    }

    // ── 3. Fetch repos from GitHub ──────────────────────────────────────────
    let githubRepos;
    try {
      githubRepos = await fetchGitHubRepos(accessToken);
    } catch (err) {
      if (err instanceof RateLimitError) {
        // Re-queue after rate limit window resets
        const delayMs = err.resetAt
          ? Math.max(0, err.resetAt.getTime() - Date.now()) + 5000
          : 60_000;
        console.warn(`[githubSync:worker] Rate limited — will retry in ${delayMs}ms`);
        throw err; // BullMQ backoff will handle retry
      }

      if (err.message?.includes('401') || err.message?.includes('Bad credentials')) {
        // Token revoked by user on GitHub side — clear it
        console.warn(`[githubSync:worker] Token revoked for user ${userId} — clearing`);
        await User.findByIdAndUpdate(userId, { $unset: { githubAccessToken: '' } });
        return { skipped: true, reason: 'token_revoked' };
      }

      throw err; // unknown error — let BullMQ retry
    }

    // ── 4. Upsert repos into MongoDB ────────────────────────────────────────
    const ops = githubRepos.map((repo) => ({
      updateOne: {
        filter: { userId, repoId: repo.id },
        update: {
          $set: {
            userId,
            repoId:      repo.id,
            repoName:    repo.name,
            fullName:    repo.full_name,
            description: repo.description || '',
            repoUrl:     repo.html_url,
            language:    repo.language,
            stars:       repo.stargazers_count,
            forks:       repo.forks_count,
            isPrivate:   repo.private,
            pushedAt:    repo.pushed_at ? new Date(repo.pushed_at) : null,
            lastSyncedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    if (ops.length > 0) {
      const result = await Repo.bulkWrite(ops, { ordered: false });
      console.log(
        `[githubSync:worker] User ${userId}: upserted ${result.upsertedCount}, ` +
        `modified ${result.modifiedCount} / ${githubRepos.length} repos`
      );
    }

    return {
      userId,
      reposSynced: githubRepos.length,
      syncedAt: new Date().toISOString(),
    };
  },
  {
    connection: createBullMQClient(),
    concurrency: 5, // handle 5 sync jobs in parallel
  }
);

// ─── Worker event hooks ───────────────────────────────────────────────────────
githubSyncWorker.on('completed', (job, result) => {
  console.log(`[githubSync:worker] Job ${job.id} completed:`, result);
});

githubSyncWorker.on('failed', (job, err) => {
  console.error(`[githubSync:worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
});

githubSyncWorker.on('error', (err) => {
  console.error('[githubSync:worker] Worker error:', err.message);
});

module.exports = { githubSyncWorker };
