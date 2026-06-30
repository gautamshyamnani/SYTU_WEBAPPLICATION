const mongoose = require('mongoose');
const logger   = require('./logger');

// No localhost fallback here, and none needed — MONGO_URI is required by
// env.js before this is ever called. On Render this must be your MongoDB
// Atlas (or other managed Mongo) connection string, set in the dashboard,
// NOT read from a committed .env file (see .env.example).
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    logger.error(`MongoDB connection error: ${err.message}`);
    process.exit(1); // Mongo is NOT optional — app cannot run without it
  }
};

module.exports = connectDB;
