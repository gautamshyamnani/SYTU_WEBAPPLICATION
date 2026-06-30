const { Worker } = require('bullmq');
const { createBullMQClient } = require('../config/redis');

// ─── Job handlers ─────────────────────────────────────────────────────────────
// Each key maps a job "name" (type) to a handler function.
// Add new email types here without touching the worker setup below.

const handlers = {
  /**
   * welcome — sent after successful registration.
   * Replace console.log with a real email provider (Nodemailer, SendGrid, etc.)
   */
  welcome: async (job) => {
    const { name, email } = job.data;
    console.log(`[EmailWorker] ✉  Sending WELCOME email`);
    console.log(`             To:      ${email}`);
    console.log(`             Subject: Welcome to the platform, ${name}!`);
    console.log(`             Body:    Hi ${name}, your account is ready. Start connecting!`);
    // TODO: replace with: await mailer.send({ to: email, template: 'welcome', data: { name } })
  },

  /**
   * password_reset — placeholder for future use.
   */
  password_reset: async (job) => {
    const { email, resetLink } = job.data;
    console.log(`[EmailWorker] ✉  Sending PASSWORD RESET email`);
    console.log(`             To:      ${email}`);
    console.log(`             Link:    ${resetLink}`);
  },
};

// ─── Worker setup ─────────────────────────────────────────────────────────────

const emailWorker = new Worker(
  'email',
  async (job) => {
    console.log(`[EmailWorker] Processing job "${job.name}" (id: ${job.id})`);

    const handler = handlers[job.name];
    if (!handler) {
      // Unknown job type — log and skip rather than crashing the worker
      console.warn(`[EmailWorker] No handler for job type "${job.name}" — skipping`);
      return;
    }

    await handler(job);
    console.log(`[EmailWorker] ✓ Completed job "${job.name}" (id: ${job.id})`);
  },
  {
    connection: createBullMQClient(),
    concurrency: 5, // process up to 5 email jobs in parallel
  }
);

// ─── Worker event hooks ────────────────────────────────────────────────────────

emailWorker.on('completed', (job) => {
  console.log(`[EmailWorker] Job completed — name: "${job.name}", id: ${job.id}`);
});

emailWorker.on('failed', (job, err) => {
  console.error(
    `[EmailWorker] Job FAILED — name: "${job?.name}", id: ${job?.id}, ` +
    `attempt: ${job?.attemptsMade}/${job?.opts?.attempts ?? '?'} — ${err.message}`
  );
});

emailWorker.on('error', (err) => {
  console.error('[EmailWorker] Worker error:', err.message);
});

module.exports = { emailWorker };
