const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      // Not required globally — GitHub may not expose email
      unique: true,
      sparse: true, // allows multiple docs without email (github users)
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      // Not required — GitHub OAuth users have no password
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    // Stores hashed refresh tokens — supports multiple devices/sessions
    refreshTokens: {
      type: [String],
      default: [],
      select: false,
    },

    // ─── Profile fields (Slice 3) ───────────────────────────────────────────
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-z0-9_]+$/, 'Username can only contain letters, numbers and underscores'],
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [300, 'Bio cannot exceed 300 characters'],
      default: '',
    },
    skills: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 20,
        message: 'You can add at most 20 skills',
      },
    },
    profilePicture: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: String,
      trim: true,
      maxlength: [100, 'Location cannot exceed 100 characters'],
      default: '',
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },

    // ─── Payments (Slice 9) ──────────────────────────────────────────────────
    isPremium: {
      type: Boolean,
      default: false,
    },

    // ─── GitHub OAuth (Slice 10) ─────────────────────────────────────────────
    githubId: {
      type: String,
      unique: true,
      sparse: true, // email-only users have no githubId
      index: true,
    },
    githubUsername: {
      type: String,
      trim: true,
      default: '',
    },
    githubProfileUrl: {
      type: String,
      trim: true,
      default: '',
    },
    // Encrypted before storage — see githubAccessToken setter/getter
    githubAccessToken: {
      type: String,
      select: false, // never returned in queries by default
    },
    githubTokenExpiry: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ─── Indexes (Slice 12 — Search + Filters + Pagination) ─────────────────────
// `username` already gets a unique index from `unique: true` above — adding
// a second plain index on the same field would throw a Mongoose duplicate
// schema index warning, so we rely on that existing one for search lookups.
//
// `skills` is a multikey index (one entry per array element) — speeds up
// the skills-overlap filter and the `$in` exact-skill match used below.
userSchema.index({ skills: 1 });

// `location` — used for exact/prefix filtering. Combined with the compound
// index below for the common "filter by location AND profile completeness"
// case so Mongo's planner can use a single index instead of intersecting two.
userSchema.index({ location: 1 });
userSchema.index({ location: 1, isProfileComplete: 1 });

// ─── Profile completion check ────────────────────────────────────────────────
userSchema.methods.checkProfileComplete = function () {
  return !!(
    this.username &&
    this.bio &&
    this.skills.length > 0 &&
    this.location
  );
};

// Hash password before saving (skip for GitHub-only users with no password)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare plain password against stored hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false; // GitHub-only user — no password set
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
