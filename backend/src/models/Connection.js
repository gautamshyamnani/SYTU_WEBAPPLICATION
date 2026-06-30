const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'rejected'],
        message: 'Status must be pending, accepted, or rejected',
      },
      default: 'pending',
    },
  },
  { timestamps: true }
);

// Compound index: one directional record per pair, fast lookups
connectionSchema.index({ sender: 1, receiver: 1 }, { unique: true });
// Speed up "find all connections involving a user"
connectionSchema.index({ receiver: 1, status: 1 });
connectionSchema.index({ sender: 1, status: 1 });

module.exports = mongoose.model('Connection', connectionSchema);
