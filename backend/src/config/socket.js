const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createPubSubClient } = require('./redis');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Connection = require('../models/Connection');
const Message = require('../models/Message');
const {
  setOnline,
  setOffline,
  getSocketId,
  getOnlineUserIds,
} = require('../utils/presenceStore');
const { addNotificationJob } = require('../utils/queue'); // Slice 11

// ─── IO Singleton ─────────────────────────────────────────────────────────────
// Stored here so workers and other modules can call getIO() to emit events
// without creating circular dependency chains.
let _io = null;

/**
 * Returns the Socket.IO server instance.
 * Throws if called before initSocket() — workers boot after the server starts,
 * so this is safe in practice.
 */
const getIO = () => {
  if (!_io) throw new Error('[Socket.IO] getIO() called before initSocket()');
  return _io;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Check that two users have an accepted connection (either direction) */
const areConnected = async (userAId, userBId) => {
  const record = await Connection.findOne({
    $or: [
      { sender: userAId, receiver: userBId },
      { sender: userBId, receiver: userAId },
    ],
    status: 'accepted',
  }).lean();
  return !!record;
};

// ─── Socket initialisation ────────────────────────────────────────────────────

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || '*', // tighten in production
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // ── Redis adapter — enables multi-instance horizontal scaling ─────────────
  // Each server instance shares events through Redis pub/sub.
  // Two dedicated clients are required (one pub, one sub) — never share
  // them with cache or BullMQ connections.
  try {
    const pubClient = createPubSubClient();
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[Socket.IO] Redis adapter attached');
  } catch (err) {
    // Adapter failure is non-fatal in single-instance dev environments
    console.error('[Socket.IO] Redis adapter failed — running without it:', err.message);
  }

  // ── JWT authentication middleware ─────────────────────────────────────────
  // Runs before any event handler. Rejects the connection if token is missing
  // or invalid — the socket never reaches the 'connection' handler.
  io.use(async (socket, next) => {
    try {
      // Clients can send the token in the handshake auth object:
      //   socket = io(URL, { auth: { token: "<accessToken>" } })
      // or as a query param (fallback for simpler clients):
      //   socket = io(URL, { query: { token: "<accessToken>" } })
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('AUTH_MISSING: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id name username');

      if (!user) {
        return next(new Error('AUTH_INVALID: User not found'));
      }

      // Attach user to socket for use in all event handlers
      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new Error('AUTH_EXPIRED: Access token expired'));
      }
      return next(new Error('AUTH_INVALID: Invalid token'));
    }
  });

  // ── Connection handler ────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`[Socket] Connected: ${userId} (${socket.id})`);

    // Register user as online
    setOnline(userId, socket.id);

    // Broadcast to everyone that this user came online
    socket.broadcast.emit('user:online', {
      userId,
      name: socket.user.name,
      username: socket.user.username || null,
    });

    // Send the current online user list to the newly connected client
    socket.emit('presence:list', { onlineUsers: getOnlineUserIds() });

    // ── Push unread notification count on connect (Slice 11) ─────────────────
    // Lets client badge its notification icon immediately, no REST call needed.
    (async () => {
      try {
        const Notification = require('../models/Notification');
        const unreadCount = await Notification.countDocuments({ userId, isRead: false });
        if (unreadCount > 0) {
          socket.emit('notification:unread_count', { unreadCount });
        }
      } catch (err) {
        console.error('[Socket] unread count push error:', err.message);
      }
    })();

    // ── message:send ─────────────────────────────────────────────────────────
    // Payload: { receiverId: string, message: string }
    socket.on('message:send', async (payload, ack) => {
      try {
        const { receiverId, message } = payload || {};

        // ── Input validation ──
        if (!receiverId || typeof receiverId !== 'string') {
          return ack?.({ success: false, error: 'receiverId is required' });
        }
        if (!message || typeof message !== 'string' || !message.trim()) {
          return ack?.({ success: false, error: 'message cannot be empty' });
        }
        if (message.trim().length > 2000) {
          return ack?.({ success: false, error: 'message exceeds 2000 characters' });
        }
        if (receiverId === userId) {
          return ack?.({ success: false, error: 'Cannot message yourself' });
        }

        // ── Connection guard ──
        const connected = await areConnected(userId, receiverId);
        if (!connected) {
          return ack?.({
            success: false,
            error: 'You can only message users you are connected with',
          });
        }

        // ── Persist to MongoDB ──
        const saved = await Message.create({
          sender: userId,
          receiver: receiverId,
          message: message.trim(),
        });

        const msgPayload = {
          messageId: saved._id,
          senderId: userId,
          receiverId,
          message: saved.message,
          createdAt: saved.createdAt,
        };

        // ── Deliver to receiver if online ──
        const receiverSocketId = getSocketId(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('message:receive', msgPayload);
        }

        // ── Queue notification (Slice 11) — fire-and-forget ──
        addNotificationJob('message', {
          userId:      receiverId,
          type:        'message',
          message:     `${socket.user.name} sent you a message`,
          referenceId: saved._id.toString(),
        }).catch((err) => console.error('[Socket] notification job error:', err.message));

        // Acknowledge success back to sender (includes saved message ID + timestamp)
        ack?.({ success: true, data: msgPayload });
      } catch (err) {
        console.error('[Socket] message:send error:', err);
        ack?.({ success: false, error: 'Server error' });
      }
    });

    // ── typing:start ──────────────────────────────────────────────────────────
    // Payload: { receiverId: string }
    socket.on('typing:start', ({ receiverId } = {}) => {
      if (!receiverId) return;
      const receiverSocketId = getSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing:start', { senderId: userId });
      }
    });

    // ── typing:stop ───────────────────────────────────────────────────────────
    // Payload: { receiverId: string }
    socket.on('typing:stop', ({ receiverId } = {}) => {
      if (!receiverId) return;
      const receiverSocketId = getSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing:stop', { senderId: userId });
      }
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${userId} — ${reason}`);
      setOffline(userId);

      // Broadcast offline event to all other connected clients
      socket.broadcast.emit('user:offline', { userId });
    });
  });

  _io = io;  // store in singleton so getIO() works from workers
  return io;
};

module.exports = { initSocket, getIO };
