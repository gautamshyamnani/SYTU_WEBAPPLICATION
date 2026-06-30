const { cacheKey, deleteCache } = require('../utils/cache');
const mongoose = require('mongoose');
const Connection = require('../models/Connection');
const User = require('../models/User');
const { addNotificationJob } = require('../utils/queue'); // Slice 11

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/** Safe public profile to attach to connection results */
const publicUser = (user) =>
  user
    ? {
        id: user._id,
        name: user.name,
        username: user.username || null,
        profilePicture: user.profilePicture || '',
        location: user.location || '',
        bio: user.bio || '',
      }
    : null;

// ─── POST /api/connections/send/:userId ──────────────────────────────────────

// @desc    Send a connection request to another user
// @route   POST /api/connections/send/:userId
// @access  Private
const sendRequest = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { userId: receiverId } = req.params;

    // ── Validate receiver ID ──
    if (!isValidObjectId(receiverId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    // ── Cannot send to self ──
    if (senderId.toString() === receiverId) {
      return res
        .status(400)
        .json({ success: false, message: 'You cannot send a connection request to yourself' });
    }

    // ── Receiver must exist ──
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ── Check for any existing connection record in either direction ──
    const existing = await Connection.findOne({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId },
      ],
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res
          .status(409)
          .json({ success: false, message: 'You are already connected with this user' });
      }
      if (existing.status === 'pending') {
        return res
          .status(409)
          .json({ success: false, message: 'A connection request is already pending' });
      }
      // status === 'rejected' — allow re-sending by updating the existing record
      existing.sender = senderId;
      existing.receiver = receiverId;
      existing.status = 'pending';
      await existing.save();

      // Invalidate discovery cache for both users
      await deleteCache(
        cacheKey('discovery', senderId.toString()),
        cacheKey('discovery', receiverId.toString())
      );

      // ── Notify receiver (Slice 11) — fire-and-forget ──
      addNotificationJob('connection_request', {
        userId:      receiverId,
        type:        'connection_request',
        message:     `${req.user.name} sent you a connection request`,
        referenceId: existing._id.toString(),
      }).catch((err) => console.error('[Connection] notification job error:', err.message));

      return res.status(200).json({
        success: true,
        message: 'Connection request re-sent',
        connection: existing,
      });
    }

    // ── Create new request ──
    const connection = await Connection.create({
      sender: senderId,
      receiver: receiverId,
    });

    // Invalidate discovery cache for both users
    await deleteCache(
      cacheKey('discovery', senderId.toString()),
      cacheKey('discovery', receiverId.toString())
    );

    // ── Notify receiver (Slice 11) — fire-and-forget ──
    addNotificationJob('connection_request', {
      userId:      receiverId.toString(),
      type:        'connection_request',
      message:     `${req.user.name} sent you a connection request`,
      referenceId: connection._id.toString(),
    }).catch((err) => console.error('[Connection] notification job error:', err.message));

    res.status(201).json({
      success: true,
      message: 'Connection request sent',
      connection,
    });
  } catch (err) {
    // Duplicate key from race condition (the unique index catches it)
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: 'A connection request is already pending' });
    }
    console.error('sendRequest error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── PUT /api/connections/respond/:requestId ─────────────────────────────────

// @desc    Accept or reject an incoming connection request
// @route   PUT /api/connections/respond/:requestId
// @body    { "action": "accepted" | "rejected" }
// @access  Private
const respondToRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body;

    // ── Validate request ID ──
    if (!isValidObjectId(requestId)) {
      return res.status(400).json({ success: false, message: 'Invalid request ID' });
    }

    // ── Validate action ──
    if (!action || !['accepted', 'rejected'].includes(action)) {
      return res
        .status(400)
        .json({ success: false, message: 'Action must be "accepted" or "rejected"' });
    }

    // ── Find request ──
    const connection = await Connection.findById(requestId);
    if (!connection) {
      return res.status(404).json({ success: false, message: 'Connection request not found' });
    }

    // ── Only the receiver can respond ──
    if (connection.receiver.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not authorized to respond to this request' });
    }

    // ── Only pending requests can be responded to ──
    if (connection.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${connection.status}`,
      });
    }

    connection.status = action;
    await connection.save();

    // Invalidate discovery cache for both users
    await deleteCache(
      cacheKey('discovery', connection.sender.toString()),
      cacheKey('discovery', connection.receiver.toString())
    );

    // ── Notify sender only when accepted (Slice 11) ──
    if (action === 'accepted') {
      addNotificationJob('connection_accepted', {
        userId:      connection.sender.toString(),
        type:        'connection_accepted',
        message:     `${req.user.name} accepted your connection request`,
        referenceId: connection._id.toString(),
      }).catch((err) => console.error('[Connection] notification job error:', err.message));
    }

    res.status(200).json({
      success: true,
      message: `Connection request ${action}`,
      connection,
    });
  } catch (err) {
    console.error('respondToRequest error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET /api/connections/requests ───────────────────────────────────────────

// @desc    Get all incoming pending connection requests for the logged-in user
// @route   GET /api/connections/requests
// @access  Private
const getPendingRequests = async (req, res) => {
  try {
    const requests = await Connection.find({
      receiver: req.user._id,
      status: 'pending',
    })
      .populate('sender', 'name username profilePicture location bio')
      .sort({ createdAt: -1 });

    const formatted = requests.map((r) => ({
      requestId: r._id,
      status: r.status,
      createdAt: r.createdAt,
      sender: publicUser(r.sender),
    }));

    res.status(200).json({
      success: true,
      count: formatted.length,
      requests: formatted,
    });
  } catch (err) {
    console.error('getPendingRequests error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET /api/connections/list ────────────────────────────────────────────────

// @desc    Get all accepted connections for the logged-in user
// @route   GET /api/connections/list
// @access  Private
const getConnections = async (req, res) => {
  try {
    const userId = req.user._id;

    const connections = await Connection.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: 'accepted',
    })
      .populate('sender', 'name username profilePicture location bio')
      .populate('receiver', 'name username profilePicture location bio')
      .sort({ updatedAt: -1 });

    // Return the "other" person in each connection
    const formatted = connections.map((c) => {
      const isSender = c.sender._id.toString() === userId.toString();
      const otherUser = isSender ? c.receiver : c.sender;
      return {
        connectionId: c._id,
        connectedAt: c.updatedAt,
        user: publicUser(otherUser),
      };
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      connections: formatted,
    });
  } catch (err) {
    console.error('getConnections error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { sendRequest, respondToRequest, getPendingRequests, getConnections };
