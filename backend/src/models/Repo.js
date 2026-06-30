const mongoose = require('mongoose');

/**
 * Repo — stores synced GitHub repository data per user.
 *
 * One document per user+repo pair. Upserted on each sync run
 * so re-syncing is idempotent (repoId is the natural key).
 */
const repoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // GitHub's numeric repo ID — stable even after rename
    repoId: {
      type: Number,
      required: true,
    },
    repoName: {
      type: String,
      required: true,
      trim: true,
    },
    fullName: {
      type: String,        // e.g. "octocat/Hello-World"
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Description too long'],
    },
    repoUrl: {
      type: String,
      trim: true,
      required: true,
    },
    language: {
      type: String,
      trim: true,
      default: null,
    },
    stars: {
      type: Number,
      default: 0,
    },
    forks: {
      type: Number,
      default: 0,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    pushedAt: {
      type: Date,
      default: null,
    },
    // When this record was last synced from GitHub
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound unique index: one document per user+repo
repoSchema.index({ userId: 1, repoId: 1 }, { unique: true });

module.exports = mongoose.model('Repo', repoSchema);
