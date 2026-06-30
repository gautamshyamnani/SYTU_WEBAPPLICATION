const mongoose = require('mongoose');
const { getRedisClient } = require('../config/redis');

// @desc    Liveness/readiness probe — used by Docker, load balancers, uptime monitors
// @route   GET /api/health
// @access  Public
const getHealth = async (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  let redisOk = false;
  try {
    const redis = getRedisClient();
    redisOk = !!redis && (redis.status === 'ready' || redis.status === 'connect');
  } catch {
    redisOk = false;
  }

  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      mongo: dbState === 1 ? 'connected' : 'disconnected',
      redis: redisOk ? 'connected' : 'disconnected',
    },
  });
};

module.exports = { getHealth };
