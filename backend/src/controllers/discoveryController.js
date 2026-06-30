const mongoose = require('mongoose');
const User = require('../models/User');
const Connection = require('../models/Connection');
const { computeMatchScore } = require('../utils/matchScore');
const { cacheKey, getCache, setCache } = require('../utils/cache');

const DISCOVERY_TTL = 60; // seconds
const DISCOVERY_NS = 'discovery';

// ─── GET /api/discovery ───────────────────────────────────────────────────────

// @desc    Return ranked list of users the logged-in user could connect with
// @route   GET /api/discovery?limit=10
// @access  Private
const discoverUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // ── Parse & clamp limit ──────────────────────────────────────────────────
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    // ── Cache check ──────────────────────────────────────────────────────────
    // Key is per-user so each user gets their own tailored list.
    // limit is intentionally NOT part of the key — we cache the full scored
    // list and slice it here, so a ?limit=5 and ?limit=10 share one cache entry.
    const key = cacheKey(DISCOVERY_NS, currentUserId.toString());
    const cached = await getCache(key);

    if (cached) {
      console.log(`[Cache] HIT  ${key}`);
      return res.status(200).json({
        success: true,
        count: Math.min(cached.length, limit),
        limit,
        fromCache: true,
        users: cached.slice(0, limit),
      });
    }

    console.log(`[Cache] MISS ${key}`);

    // ── Step 1: Fetch all connection records involving the current user ──────
    const connectionDocs = await Connection.find({
      $or: [{ sender: currentUserId }, { receiver: currentUserId }],
      status: { $in: ['pending', 'accepted'] },
    })
      .select('sender receiver')
      .lean();

    // Build exclusion set (self + anyone in a pending/accepted connection)
    const excludedIds = new Set([currentUserId.toString()]);
    for (const c of connectionDocs) {
      excludedIds.add(c.sender.toString());
      excludedIds.add(c.receiver.toString());
    }

    const excludedObjectIds = [...excludedIds].map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    // ── Step 2: Fetch candidate users — one DB round trip ───────────────────
    // Fetch up to 200 candidates; score + sort in memory.
    const candidates = await User.find({ _id: { $nin: excludedObjectIds } })
      .select('name username bio skills location profilePicture isProfileComplete')
      .limit(200)
      .lean();

    // ── Step 3: Score & sort ─────────────────────────────────────────────────
    const scored = candidates
      .map((candidate) => ({
        userId: candidate._id,
        name: candidate.name,
        username: candidate.username || null,
        bio: candidate.bio || '',
        skills: candidate.skills || [],
        location: candidate.location || '',
        profilePicture: candidate.profilePicture || '',
        isProfileComplete: candidate.isProfileComplete || false,
        matchScore: computeMatchScore(req.user, candidate),
      }))
      .sort((a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name));

    // ── Step 4: Store full ranked list in cache (TTL = 60 s) ─────────────────
    await setCache(key, scored, DISCOVERY_TTL);

    res.status(200).json({
      success: true,
      count: Math.min(scored.length, limit),
      limit,
      fromCache: false,
      users: scored.slice(0, limit),
    });
  } catch (err) {
    console.error('discoverUsers error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { discoverUsers };
