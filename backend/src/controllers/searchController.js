const User = require('../models/User');
const { computeMatchScore } = require('../utils/matchScore');

// ─── Tunables ─────────────────────────────────────────────────────────────────
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50; // hard cap — prevents one request from scanning/returning huge pages

// matchScore isn't a stored field (it depends on who's asking — see
// utils/matchScore.js), so Mongo can't filter or sort by it natively.
// When `minMatchScore` is supplied we fall back to scoring a bounded
// candidate set in memory, same pattern discoveryController already uses
// (just with a slightly larger cap, since filters here narrow the set
// before we ever get to scoring). Hitting this cap means there may be more
// matches than we found — we tell the caller via `truncated: true`.
const MAX_SCORED_CANDIDATES = 500;

// Fields safe to return to other users — never email/password/tokens.
const PUBLIC_FIELDS = 'name username bio skills location profilePicture isProfileComplete createdAt';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Escape regex metacharacters in user input before building a RegExp from it
// (prevents both regex-injection surprises and accidental ReDoS patterns).
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build the Mongo filter from query params. Every clause here is additive
 * (AND'd together) so filters combine cleanly — e.g. q + location + skills
 * all narrow the same result set.
 */
const buildFilter = (req) => {
  const filter = { _id: { $ne: req.user._id } }; // never show the user their own profile
  const { q, location, skills, isProfileComplete } = req.query;

  // ── q: partial, case-insensitive match on username OR skills ─────────────
  if (typeof q === 'string' && q.trim() !== '') {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ username: regex }, { skills: regex }];
  }

  // ── location filter: partial, case-insensitive ────────────────────────────
  if (typeof location === 'string' && location.trim() !== '') {
    filter.location = new RegExp(escapeRegex(location.trim()), 'i');
  }

  // ── skills filter: exact (case-insensitive) match against named skills ────
  // Accepts ?skills=react&skills=node  OR  ?skills=react,node
  if (skills !== undefined) {
    const list = (Array.isArray(skills) ? skills : String(skills).split(','))
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length > 0) {
      filter.skills = { $in: list.map((s) => new RegExp(`^${escapeRegex(s)}$`, 'i')) };
    }
  }

  // ── profile completeness filter: exact boolean, fully indexed ─────────────
  if (isProfileComplete === 'true') filter.isProfileComplete = true;
  else if (isProfileComplete === 'false') filter.isProfileComplete = false;
  // any other value for isProfileComplete is silently ignored (lenient,
  // matches the existing `unreadOnly === 'true'` convention used elsewhere)

  return filter;
};

const toResult = (currentUser, u) => ({
  userId: u._id,
  name: u.name,
  username: u.username || null,
  bio: u.bio || '',
  skills: u.skills || [],
  location: u.location || '',
  profilePicture: u.profilePicture || '',
  isProfileComplete: !!u.isProfileComplete,
  matchScore: computeMatchScore(currentUser, u),
  createdAt: u.createdAt,
});

// ─── GET /api/users/search ────────────────────────────────────────────────────

// @desc    Search & filter users with pagination
// @route   GET /api/users/search
// @access  Private
// @query   ?q=&location=&skills=&isProfileComplete=&minMatchScore=&page=1&limit=10
const searchUsers = async (req, res) => {
  try {
    // ── 1. Parse & validate pagination params ──────────────────────────────
    // page/limit default and clamp rather than 400 — consistent with how
    // notificationController already handles these params elsewhere.
    const page = Math.max(1, parseInt(req.query.page, 10) || DEFAULT_PAGE);
    let limit = parseInt(req.query.limit, 10);
    if (Number.isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
    limit = Math.min(limit, MAX_LIMIT);

    // ── 2. Parse & validate minMatchScore (strict — a typo here shouldn't
    //    silently return an unfiltered list, so we 400 instead of defaulting) ──
    let minMatchScore = null;
    if (req.query.minMatchScore !== undefined) {
      const parsed = Number(req.query.minMatchScore);
      if (Number.isNaN(parsed) || parsed < 0) {
        return res.status(400).json({
          success: false,
          message: 'minMatchScore must be a non-negative number',
        });
      }
      minMatchScore = parsed;
    }

    const filter = buildFilter(req);

    // ── 3a. Fast path — no score filter, paginate directly in Mongo ─────────
    // This is the path that actually benefits from the indexes on
    // username/skills/location: skip/limit happens in the DB, not in memory.
    if (minMatchScore === null) {
      const [docs, total] = await Promise.all([
        User.find(filter)
          .select(PUBLIC_FIELDS)
          .sort({ username: 1, _id: 1 }) // deterministic order — stable pagination
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        User.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        total,
        page,
        pages: Math.ceil(total / limit),
        users: docs.map((u) => toResult(req.user, u)),
      });
    }

    // ── 3b. Score-filtered path — minMatchScore requires in-memory scoring ──
    // matchScore depends on the requesting user, so it can't be indexed or
    // filtered by Mongo directly. We fetch a bounded, already-filtered
    // candidate set, score it in memory (reusing the same utility
    // discoveryController uses), then filter + sort + paginate the array.
    const candidates = await User.find(filter)
      .select(PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .limit(MAX_SCORED_CANDIDATES)
      .lean();

    const truncated = candidates.length === MAX_SCORED_CANDIDATES;
    if (truncated) {
      console.warn(
        `[searchUsers] Candidate cap (${MAX_SCORED_CANDIDATES}) reached for minMatchScore filter — results may be incomplete.`
      );
    }

    const scored = candidates
      .map((u) => toResult(req.user, u))
      .filter((u) => u.matchScore >= minMatchScore)
      .sort((a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name));

    const total = scored.length;
    const start = (page - 1) * limit;

    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      truncated, // true if the candidate cap was hit — total may undercount
      users: scored.slice(start, start + limit),
    });
  } catch (err) {
    console.error('searchUsers error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { searchUsers };
