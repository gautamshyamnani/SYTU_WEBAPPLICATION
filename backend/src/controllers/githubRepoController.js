const User = require('../models/User');
const Repo = require('../models/Repo');
const { fetchGitHubRepos, decryptToken, RateLimitError } = require('../config/github');
const { githubSyncQueue } = require('../queues/githubSync.queue');

// ─── GET /api/github/repos ────────────────────────────────────────────────────
// Returns cached/synced repos from DB. Optionally triggers a fresh sync.
const getRepos = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fresh } = req.query; // ?fresh=true to force re-sync before responding

    // Verify user has GitHub linked
    const user = await User.findById(userId).select('+githubAccessToken');
    if (!user.githubId) {
      return res.status(400).json({
        success: false,
        message: 'No GitHub account linked. Please connect via /api/auth/github',
      });
    }

    if (fresh === 'true') {
      // Inline sync for immediate fresh data (blocks response)
      if (!user.githubAccessToken) {
        return res.status(401).json({
          success: false,
          message: 'GitHub access token not available. Please re-authenticate via /api/auth/github',
        });
      }

      const accessToken = decryptToken(user.githubAccessToken);
      if (!accessToken) {
        return res.status(401).json({
          success: false,
          message: 'GitHub token is invalid. Please re-authenticate via /api/auth/github',
        });
      }

      try {
        const githubRepos = await fetchGitHubRepos(accessToken);

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

        if (ops.length) await Repo.bulkWrite(ops, { ordered: false });

      } catch (err) {
        if (err instanceof RateLimitError) {
          return res.status(429).json({
            success: false,
            message: 'GitHub API rate limit exceeded',
            resetAt: err.resetAt,
          });
        }
        if (err.message?.includes('401') || err.message?.includes('Bad credentials')) {
          // Clear revoked token
          await User.findByIdAndUpdate(userId, { $unset: { githubAccessToken: '' } });
          return res.status(401).json({
            success: false,
            message: 'GitHub token revoked. Please re-authenticate via /api/auth/github',
          });
        }
        throw err;
      }
    }

    // ── Fetch from DB ─────────────────────────────────────────────────────
    const { page = 1, limit = 20, sort = 'stars', lang } = req.query;
    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const filter = { userId };
    if (lang) filter.language = lang;

    const sortMap = {
      stars:    { stars: -1 },
      forks:    { forks: -1 },
      updated:  { pushedAt: -1 },
      name:     { repoName: 1 },
    };
    const sortOrder = sortMap[sort] || sortMap.stars;

    const [repos, total] = await Promise.all([
      Repo.find(filter)
          .sort(sortOrder)
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .select('-__v'),
      Repo.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      repos,
    });

  } catch (err) {
    console.error('[getRepos]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── POST /api/github/sync ────────────────────────────────────────────────────
// Manually trigger a background repo sync job (returns immediately)
const triggerSync = async (req, res) => {
  try {
    const userId = req.user._id.toString();

    const user = await User.findById(userId);
    if (!user?.githubId) {
      return res.status(400).json({
        success: false,
        message: 'No GitHub account linked.',
      });
    }

    const job = await githubSyncQueue.add(
      'syncRepos',
      { userId },
      {
        jobId: `sync-${userId}`, // prevent duplicate queuing
      }
    );

    res.status(202).json({
      success: true,
      message: 'Repository sync queued',
      jobId: job.id,
    });

  } catch (err) {
    console.error('[triggerSync]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET /api/github/status ───────────────────────────────────────────────────
// Returns GitHub connection status for the current user
const getGitHubStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    const repoCount = user.githubId
      ? await Repo.countDocuments({ userId: user._id })
      : 0;

    const lastSync = user.githubId
      ? await Repo.findOne({ userId: user._id })
                  .sort({ lastSyncedAt: -1 })
                  .select('lastSyncedAt')
      : null;

    res.status(200).json({
      success: true,
      connected: !!user.githubId,
      githubUsername:   user.githubUsername || null,
      githubProfileUrl: user.githubProfileUrl || null,
      repoCount,
      lastSyncedAt: lastSync?.lastSyncedAt || null,
    });

  } catch (err) {
    console.error('[getGitHubStatus]', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getRepos, triggerSync, getGitHubStatus };
