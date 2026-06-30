/**
 * presenceStore — in-memory map of online users.
 *
 * Shape: Map<userId (string), socketId (string)>
 *
 * A single module export keeps the same Map instance shared across
 * all socket event handlers without needing a class or global variable.
 *
 * Upgrade path: swap this for a Redis hash when running multiple server
 * instances (horizontal scaling). The API surface stays the same.
 */

const onlineUsers = new Map(); // userId → socketId

const setOnline = (userId, socketId) => {
  onlineUsers.set(userId, socketId);
};

const setOffline = (userId) => {
  onlineUsers.delete(userId);
};

const getSocketId = (userId) => onlineUsers.get(userId) || null;

const isOnline = (userId) => onlineUsers.has(userId);

/** Returns an array of all currently online user IDs */
const getOnlineUserIds = () => [...onlineUsers.keys()];

module.exports = { setOnline, setOffline, getSocketId, isOnline, getOnlineUserIds };
