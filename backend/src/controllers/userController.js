const { cacheKey, deleteCache } = require('../utils/cache');
const User = require('../models/User');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fields that are safe to return to the client.
 * Excludes: password, refreshTokens (both select:false in schema,
 * but being explicit here too).
 */
const safeProfile = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  username: user.username || null,
  bio: user.bio,
  skills: user.skills,
  profilePicture: user.profilePicture,
  location: user.location,
  isProfileComplete: user.isProfileComplete,
  isPremium: !!user.isPremium,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// ─── GET /api/user/me ─────────────────────────────────────────────────────────

// @desc    Get current logged-in user's full profile
// @route   GET /api/user/me
// @access  Private
const getMe = (req, res) => {
  // req.user is already set by protect middleware (full doc, no password/tokens)
  res.status(200).json({
    success: true,
    user: safeProfile(req.user),
  });
};

// ─── PUT /api/user/update ─────────────────────────────────────────────────────

// @desc    Update profile fields
// @route   PUT /api/user/update
// @access  Private
const updateProfile = async (req, res) => {
  try {
    // Only these fields are allowed to be updated via this endpoint
    const ALLOWED_FIELDS = ['username', 'bio', 'skills', 'location', 'profilePicture'];

    // ── 1. Extract only allowed fields from body ──
    const updates = {};
    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: `No valid fields provided. Updatable fields: ${ALLOWED_FIELDS.join(', ')}`,
      });
    }

    // ── 2. Input validation ──────────────────────────────────────────────────

    // username
    if (updates.username !== undefined) {
      if (typeof updates.username !== 'string') {
        return res.status(400).json({ success: false, message: 'Username must be a string' });
      }
      updates.username = updates.username.trim().toLowerCase();
      if (updates.username.length < 3 || updates.username.length > 30) {
        return res.status(400).json({
          success: false,
          message: 'Username must be between 3 and 30 characters',
        });
      }
      if (!/^[a-z0-9_]+$/.test(updates.username)) {
        return res.status(400).json({
          success: false,
          message: 'Username can only contain letters, numbers and underscores',
        });
      }

      // Uniqueness check — exclude the current user
      const taken = await User.findOne({
        username: updates.username,
        _id: { $ne: req.user._id },
      });
      if (taken) {
        return res.status(409).json({ success: false, message: 'Username is already taken' });
      }
    }

    // bio
    if (updates.bio !== undefined) {
      if (typeof updates.bio !== 'string') {
        return res.status(400).json({ success: false, message: 'Bio must be a string' });
      }
      updates.bio = updates.bio.trim();
      if (updates.bio.length > 300) {
        return res.status(400).json({ success: false, message: 'Bio cannot exceed 300 characters' });
      }
    }

    // skills — must be an array of non-empty strings
    if (updates.skills !== undefined) {
      if (!Array.isArray(updates.skills)) {
        return res.status(400).json({ success: false, message: 'Skills must be an array of strings' });
      }
      if (updates.skills.length > 20) {
        return res.status(400).json({ success: false, message: 'You can add at most 20 skills' });
      }
      const cleaned = updates.skills
        .map((s) => (typeof s === 'string' ? s.trim() : null))
        .filter(Boolean);
      // Reject if any entry was not a string
      if (cleaned.length !== updates.skills.length) {
        return res.status(400).json({ success: false, message: 'Each skill must be a non-empty string' });
      }
      updates.skills = [...new Set(cleaned)]; // deduplicate
    }

    // profilePicture — must be a valid URL
    if (updates.profilePicture !== undefined) {
      if (typeof updates.profilePicture !== 'string') {
        return res.status(400).json({ success: false, message: 'profilePicture must be a string URL' });
      }
      updates.profilePicture = updates.profilePicture.trim();
      if (updates.profilePicture && !/^https?:\/\/.+/.test(updates.profilePicture)) {
        return res.status(400).json({ success: false, message: 'profilePicture must be a valid http/https URL' });
      }
    }

    // location
    if (updates.location !== undefined) {
      if (typeof updates.location !== 'string') {
        return res.status(400).json({ success: false, message: 'Location must be a string' });
      }
      updates.location = updates.location.trim();
      if (updates.location.length > 100) {
        return res.status(400).json({ success: false, message: 'Location cannot exceed 100 characters' });
      }
    }

    // ── 3. Apply updates to the user document ────────────────────────────────
    const user = await User.findById(req.user._id);

    Object.assign(user, updates);

    // ── 4. Profile completion logic ──────────────────────────────────────────
    user.isProfileComplete = user.checkProfileComplete();

    await user.save({ validateBeforeSave: true });

    // Invalidate this user's discovery cache — their profile changed
    await deleteCache(cacheKey('discovery', user._id.toString()));

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: safeProfile(user),
    });
  } catch (err) {
    // Mongoose duplicate key (username unique index race condition)
    if (err.code === 11000 && err.keyPattern?.username) {
      return res.status(409).json({ success: false, message: 'Username is already taken' });
    }
    // Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    console.error('updateProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getMe, updateProfile };
