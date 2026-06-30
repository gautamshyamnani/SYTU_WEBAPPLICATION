const mongoose = require('mongoose');
const Message = require('../models/Message');
const Connection = require('../models/Connection');

// ─── GET /api/messages/:userId ────────────────────────────────────────────────

// @desc    Get conversation history between the logged-in user and another user
// @route   GET /api/messages/:userId?limit=50&before=<messageId>
// @access  Private
const getChatHistory = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { userId: otherUserId } = req.params;

    // ── Validate other user ID ──
    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    if (currentUserId.toString() === otherUserId) {
      return res.status(400).json({ success: false, message: 'Cannot fetch chat with yourself' });
    }

    // ── Connection guard — only connected users can view history ──
    const connection = await Connection.findOne({
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId },
      ],
      status: 'accepted',
    }).lean();

    if (!connection) {
      return res.status(403).json({
        success: false,
        message: 'You can only view chat history with users you are connected with',
      });
    }

    // ── Parse query params ──
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

    // Cursor-based pagination: fetch messages older than a given messageId
    const filter = {
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId },
      ],
    };

    if (req.query.before && mongoose.Types.ObjectId.isValid(req.query.before)) {
      // ObjectId encodes creation time — this avoids a separate createdAt index lookup
      filter._id = { $lt: new mongoose.Types.ObjectId(req.query.before) };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 }) // newest first — client reverses for display
      .limit(limit)
      .select('sender receiver message createdAt')
      .lean();

    // Reverse so they arrive in chronological order
    messages.reverse();

    res.status(200).json({
      success: true,
      count: messages.length,
      hasMore: messages.length === limit, // hint for client pagination
      messages,
    });
  } catch (err) {
    console.error('getChatHistory error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getChatHistory };
