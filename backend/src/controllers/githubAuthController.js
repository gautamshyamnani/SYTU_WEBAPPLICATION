const crypto = require('crypto');
const User   = require('../models/User');
const {
  buildGitHubAuthURL,
  exchangeCodeForToken,
  fetchGitHubUser,
  fetchGitHubEmails,
  encryptToken,
} = require('../config/github');
const { generateAccessToken, generateRefreshToken, hashToken } = require('../config/jwt');
const { githubSyncQueue } = require('../queues/githubSync.queue');

// ─── Shared cookie opts (same as authController) ─────────────────────────────
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: parseInt(process.env.REFRESH_TOKEN_COOKIE_MS || '604800000', 10),
};

/**
 * Build and return a JWT pair for the given user, same as email/password login.
 * Appends hashed refresh token to the user's session list.
 */
const issueTokens = async (user, res) => {
  const accessToken  = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken();
  const hashed       = hashToken(refreshToken);

  // Append, cap at 10 sessions
  const userDoc = await User.findById(user._id).select('+refreshTokens');
  userDoc.refreshTokens = [...(userDoc.refreshTokens || []), hashed].slice(-10);
  await userDoc.save({ validateBeforeSave: false });

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  return { accessToken, refreshToken };
};

const safeUser = (user) => ({
  id:            user._id,
  name:          user.name,
  email:         user.email || null,
  isPremium:     !!user.isPremium,
  githubUsername: user.githubUsername || null,
  githubProfileUrl: user.githubProfileUrl || null,
  createdAt:     user.createdAt,
});

// ─── STEP 1: Redirect to GitHub ───────────────────────────────────────────────
// GET /api/auth/github
const redirectToGitHub = (req, res) => {
  // Generate a random state token for CSRF protection
  // Store in cookie so we can verify on callback
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('gh_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes — long enough for slow users
  });

  const url = buildGitHubAuthURL(state);
  res.redirect(url);
};

// ─── STEP 2: Handle GitHub callback ──────────────────────────────────────────
// GET /api/auth/github/callback
const handleGitHubCallback = async (req, res) => {
  const { code, state, error } = req.query;

  // ── Handle user-denied or GitHub error ─────────────────────────────────
  if (error) {
    return res.status(400).json({
      success: false,
      message: `GitHub OAuth error: ${error}`,
    });
  }

  // ── Validate state (CSRF check) ─────────────────────────────────────────
  const storedState = req.cookies?.gh_oauth_state;
  if (!storedState || storedState !== state) {
    return res.status(400).json({
      success: false,
      message: 'Invalid OAuth state — possible CSRF attack. Please try again.',
    });
  }
  // Clear the one-time state cookie
  res.clearCookie('gh_oauth_state');

  if (!code) {
    return res.status(400).json({ success: false, message: 'No code received from GitHub' });
  }

  try {
    // ── Exchange code → access token ──────────────────────────────────────
    const githubAccessToken = await exchangeCodeForToken(code);

    // ── Fetch GitHub profile ──────────────────────────────────────────────
    const [githubUser, primaryEmail] = await Promise.all([
      fetchGitHubUser(githubAccessToken),
      fetchGitHubEmails(githubAccessToken),
    ]);

    const githubId       = String(githubUser.id);
    const githubUsername = githubUser.login;
    const githubAvatar   = githubUser.avatar_url || '';
    const githubProfile  = githubUser.html_url || '';
    // Use API email, then public profile email, then null
    const email          = primaryEmail || githubUser.email || null;

    // ── Find or create user ───────────────────────────────────────────────
    let user = await User.findOne({ githubId });

    if (!user && email) {
      // Check if a local account already exists with this email
      user = await User.findOne({ email });
    }

    if (user) {
      // ── Existing user: update GitHub metadata + token ─────────────────
      user.githubId         = githubId;
      user.githubUsername   = githubUsername;
      user.githubProfileUrl = githubProfile;
      user.githubAccessToken = encryptToken(githubAccessToken); // encrypted at rest
      if (!user.profilePicture && githubAvatar) {
        user.profilePicture = githubAvatar;
      }
      if (!user.email && email) {
        user.email = email;
      }
      await user.save({ validateBeforeSave: false });
    } else {
      // ── New user: create from GitHub profile ──────────────────────────
      // Derive a unique username from GitHub login
      let baseUsername = githubUsername.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (baseUsername.length < 3) baseUsername = `gh_${baseUsername}`;

      // Ensure uniqueness by appending a short suffix if needed
      let finalUsername = baseUsername;
      let suffix = 0;
      while (await User.exists({ username: finalUsername })) {
        suffix++;
        finalUsername = `${baseUsername}_${suffix}`;
      }

      user = await User.create({
        name:             githubUser.name || githubUsername,
        email:            email || undefined, // undefined so sparse index allows null
        githubId,
        githubUsername,
        githubProfileUrl: githubProfile,
        githubAccessToken: encryptToken(githubAccessToken),
        profilePicture:   githubAvatar,
        username:         finalUsername,
        bio:              githubUser.bio || '',
        location:         githubUser.location || '',
      });
    }

    // ── Issue JWT (same flow as email/password login) ─────────────────────
    const { accessToken, refreshToken } = await issueTokens(user, res);

    // ── Enqueue background repo sync ──────────────────────────────────────
    // Fire-and-forget — never blocks the OAuth response
    await githubSyncQueue.add(
      'syncRepos',
      { userId: user._id.toString() },
      {
        jobId: `sync-${user._id}`, // deduplicate if already queued
        delay: 2000,               // small delay so OAuth fully settles first
      }
    ).catch((err) =>
      console.error('[githubAuth] Failed to enqueue repo sync:', err.message)
    );

    // ── Respond ───────────────────────────────────────────────────────────
    // In a real app you'd redirect to a frontend URL with the token in query/hash.
    // For API-first usage we return JSON.
    res.status(200).json({
      success: true,
      message: 'GitHub OAuth login successful',
      accessToken,
      refreshToken,
      user: safeUser(user),
    });

  } catch (err) {
    console.error('[githubAuth] Callback error:', err.message);
    res.status(500).json({ success: false, message: 'GitHub authentication failed' });
  }
};

module.exports = { redirectToGitHub, handleGitHubCallback };
