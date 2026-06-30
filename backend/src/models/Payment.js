const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Razorpay order id — created up-front, before the user pays
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Razorpay payment id — only known once the user actually pays.
    // Not unique at the schema level: a failed-then-retried order can
    // produce more than one payment attempt against the same order.
    paymentId: {
      type: String,
      default: null,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: [1, 'Amount must be greater than 0'],
    },

    // ISO 4217 currency code. Razorpay default is INR.
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'INR',
    },

    status: {
      type: String,
      enum: {
        values: ['created', 'success', 'failed'],
        message: 'Status must be created, success, or failed',
      },
      default: 'created',
    },

    // Raw Razorpay webhook event that last updated this record.
    // Useful for debugging / audit without needing a separate log table.
    lastWebhookEvent: {
      type: String,
      default: null,
    },

    // Failure reason, when available (from payment.failed payload).
    failureReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Fast lookup of a user's payment history
paymentSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
