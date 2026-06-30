const { addEmailJob } = require('../utils/queue');
const User = require('../models/User');
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} = require('../config/jwt');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Cookie options for the refresh token.
 * httpOnly → JS can't read it (XSS safe).
 * secure   → HTTPS only in production.
 * sameSite → cross-site cookies must be 'none' when frontend/backend are on different domains.
 */
const isProduction = process.env.NODE_ENV === 'production';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: parseInt(process.env.REFRESH_TOKEN_COOKIE_MS || '604800000', 10), // 7 days in ms
};

const safeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  isPremium: !!user.isPremium,
  createdAt: user.createdAt,
});

// ─── Register ───────────────────────────────────────────────────────────────

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Please provide name, email and password' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password });

    // Queue welcome email — fire-and-forget, never blocks the response
    await addEmailJob('welcome', { userId: user._id, name: user.name, email: user.email });

    // On register we only issue an access token — user must login to get refresh token
    const accessToken = generateAccessToken(user._id);

    res.status(201).json({
      success: true,
      accessToken,
      user: safeUser(user),
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Login ──────────────────────────────────────────────────────────────────

// @desc    Login — returns access token (body) + refresh token (HTTP-only cookie & body)
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Please provide email and password' });
    }

    // Explicitly select password and refreshTokens (both excluded by default)
    const user = await User.findOne({ email }).select('+password +refreshTokens');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken();
    const hashedRefreshToken = hashToken(refreshToken);

    // Append hashed refresh token to user's token list (multi-device support)
    // Cap at 10 sessions — drop the oldest if exceeded
    user.refreshTokens = [...user.refreshTokens, hashedRefreshToken].slice(-10);
    await user.save({ validateBeforeSave: false });

    // Send raw refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      accessToken,
      refreshToken, // also in body so Postman/curl clients can use it
      user: safeUser(user),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Refresh ─────────────────────────────────────────────────────────────────

// @desc    Issue new access token using a valid refresh token
// @route   POST /api/auth/refresh
// @access  Public (but requires valid refresh token)
const refresh = async (req, res) => {
  try {
    // Accept token from cookie OR request body (Postman-friendly)
    const incomingToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!incomingToken) {
      return res
        .status(401)
        .json({ success: false, message: 'Refresh token not provided' });
    }

    const hashedIncoming = hashToken(incomingToken);

    // Find user who owns this refresh token
    const user = await User.findOne({ refreshTokens: hashedIncoming }).select(
      '+refreshTokens'
    );

    if (!user) {
      // Token not found — could be reuse after logout (token rotation attack)
      return res
        .status(401)
        .json({ success: false, message: 'Invalid or expired refresh token' });
    }

    // Token rotation: remove old token, issue a fresh one
    const newRefreshToken = generateRefreshToken();
    const hashedNewRefreshToken = hashToken(newRefreshToken);

    user.refreshTokens = user.refreshTokens
      .filter((t) => t !== hashedIncoming)
      .concat(hashedNewRefreshToken)
      .slice(-10);

    await user.save({ validateBeforeSave: false });

    const newAccessToken = generateAccessToken(user._id);

    // Rotate the cookie too
    res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken, // in body for Postman
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Logout ──────────────────────────────────────────────────────────────────

// @desc    Logout — invalidate the current refresh token
// @route   POST /api/auth/logout
// @access  Private (requires valid access token via protect middleware)
const logout = async (req, res) => {
  try {
    const incomingToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (incomingToken) {
      const hashedIncoming = hashToken(incomingToken);

      // Remove this specific token (only logs out this device/session)
      await User.findByIdAndUpdate(
        req.user._id,
        { $pull: { refreshTokens: hashedIncoming } },
        { new: true }
      );
    }

    // Clear the cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    });

    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { register, login, refresh, logout };
