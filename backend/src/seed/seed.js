/**
 * seed.js — Development seed script
 *
 * Populates the database with sample users and connections so the API
 * can be explored (via Postman or Swagger UI at /api/docs) without
 * manually registering accounts first.
 *
 * Usage:
 *   npm run seed            # add sample data (skips users that already exist)
 *   npm run seed:fresh      # wipe seeded users/connections first, then re-seed
 *
 * Safety:
 *   - Only ever touches the users this script created (matched by email
 *     domain @seed.local) plus connections between them — never touches
 *     real user data.
 *   - Refuses to run with NODE_ENV=production unless ALLOW_PROD_SEED=true
 *     is explicitly set, to prevent accidentally seeding a live database.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Connection = require('../models/Connection');

const SEED_EMAIL_DOMAIN = '@seed.local';
const FRESH = process.argv.includes('--fresh');

// ─── Sample data ──────────────────────────────────────────────────────────────

const SAMPLE_USERS = [
  {
    name: 'Asha Verma',
    email: `asha${SEED_EMAIL_DOMAIN}`,
    password: 'Password123',
    username: 'asha_dev',
    bio: 'Full-stack engineer who loves React and Node.',
    skills: ['javascript', 'react', 'node', 'mongodb'],
    location: 'Bengaluru, India',
  },
  {
    name: 'Rohan Mehta',
    email: `rohan${SEED_EMAIL_DOMAIN}`,
    password: 'Password123',
    username: 'rohan_codes',
    bio: 'Backend-leaning generalist. Currently deep in Go and Postgres.',
    skills: ['go', 'postgres', 'docker', 'kubernetes'],
    location: 'Pune, India',
  },
  {
    name: 'Priya Nair',
    email: `priya${SEED_EMAIL_DOMAIN}`,
    password: 'Password123',
    username: 'priya_ux',
    bio: 'Product-minded frontend dev. Design systems enthusiast.',
    skills: ['react', 'typescript', 'figma', 'css'],
    location: 'Kochi, India',
  },
  {
    name: 'Karan Singh',
    email: `karan${SEED_EMAIL_DOMAIN}`,
    password: 'Password123',
    username: 'karan_ml',
    bio: 'ML engineer exploring LLM tooling and RAG pipelines.',
    skills: ['python', 'pytorch', 'llm', 'rag'],
    location: 'Delhi, India',
  },
  {
    name: 'Sneha Joshi',
    email: `sneha${SEED_EMAIL_DOMAIN}`,
    password: 'Password123',
    username: 'sneha_devops',
    bio: 'DevOps/SRE. Keeps things running at 3am so you do not have to.',
    skills: ['aws', 'terraform', 'docker', 'ci/cd'],
    location: 'Mumbai, India',
  },
];

// Connections to create AFTER users exist, expressed as [senderUsername, receiverUsername, status]
const SAMPLE_CONNECTIONS = [
  ['asha_dev', 'rohan_codes', 'accepted'],
  ['asha_dev', 'priya_ux', 'accepted'],
  ['karan_ml', 'asha_dev', 'pending'],
  ['sneha_devops', 'rohan_codes', 'pending'],
  ['priya_ux', 'karan_ml', 'accepted'],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const log = (...args) => console.log('[seed]', ...args);

const guardAgainstProd = () => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    console.error(
      '\n❌  Refusing to seed a production database.\n' +
        '    Set ALLOW_PROD_SEED=true if you really mean to do this.\n'
    );
    process.exit(1);
  }
};

const wipeSeedData = async () => {
  const seededUsers = await User.find({ email: { $regex: `${SEED_EMAIL_DOMAIN}$` } }).select('_id');
  const seededIds = seededUsers.map((u) => u._id);

  if (seededIds.length === 0) return;

  await Connection.deleteMany({
    $or: [{ sender: { $in: seededIds } }, { receiver: { $in: seededIds } }],
  });
  await User.deleteMany({ _id: { $in: seededIds } });

  log(`Removed ${seededIds.length} previously seeded user(s) and their connections`);
};

const seedUsers = async () => {
  const usersByUsername = {};

  for (const data of SAMPLE_USERS) {
    let user = await User.findOne({ email: data.email });

    if (user) {
      log(`Skipping existing user: ${data.email}`);
    } else {
      // User.create() triggers the pre('save') hook, which hashes the password.
      user = await User.create({
        ...data,
        isProfileComplete: true,
      });
      log(`Created user: ${user.email} (${user.username})`);
    }

    usersByUsername[data.username] = user;
  }

  return usersByUsername;
};

const seedConnections = async (usersByUsername) => {
  let created = 0;
  let skipped = 0;

  for (const [senderUsername, receiverUsername, status] of SAMPLE_CONNECTIONS) {
    const sender = usersByUsername[senderUsername];
    const receiver = usersByUsername[receiverUsername];

    if (!sender || !receiver) {
      log(`Skipping connection — missing user(s): ${senderUsername} -> ${receiverUsername}`);
      continue;
    }

    const existing = await Connection.findOne({
      $or: [
        { sender: sender._id, receiver: receiver._id },
        { sender: receiver._id, receiver: sender._id },
      ],
    });

    if (existing) {
      skipped++;
      continue;
    }

    await Connection.create({ sender: sender._id, receiver: receiver._id, status });
    created++;
  }

  log(`Connections — created: ${created}, skipped (already existed): ${skipped}`);
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const run = async () => {
  guardAgainstProd();

  if (!process.env.MONGO_URI) {
    console.error('❌  MONGO_URI is not set — check your .env file');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  log(`Connected to MongoDB: ${mongoose.connection.host}`);

  if (FRESH) {
    log('--fresh flag detected — wiping previously seeded data first');
    await wipeSeedData();
  }

  const usersByUsername = await seedUsers();
  await seedConnections(usersByUsername);

  log('Done. Sample login: any seeded email above with password "Password123".');

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
