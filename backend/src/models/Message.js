const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
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
    message: {
      type: String,
      required: [true, 'Message cannot be empty'],
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
  },
  { timestamps: true }
);

// Efficient conversation lookup — fetch messages between two users sorted by time
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
