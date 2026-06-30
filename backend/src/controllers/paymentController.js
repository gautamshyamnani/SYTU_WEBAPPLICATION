const crypto = require('crypto');
const Razorpay = require('razorpay');

const Payment = require('../models/Payment');
const User = require('../models/User');
const { getRazorpayInstance } = require('../config/razorpay');
const { addNotificationJob } = require('../utils/queue'); // Slice 11

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Only these currencies are supported for now — keeps validation simple & explicit. */
const SUPPORTED_CURRENCIES = ['INR', 'USD'];

/**
 * Constant-time string comparison wrapper.
 * crypto.timingSafeEqual throws if buffer lengths differ, so guard that first
 * (a length mismatch simply means "not equal", not an error).
 */
const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Verify the checkout-handler signature Razorpay returns after a successful
 * payment. Per Razorpay docs the payload is `order_id|payment_id`, HMAC-SHA256
 * signed with the account's key_secret.
 */
const verifyOrderPaymentSignature = (orderId, paymentId, signature) => {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeEqual(expected, signature);
};

const safePayment = (payment) => ({
  id: payment._id,
  orderId: payment.orderId,
  paymentId: payment.paymentId,
  amount: payment.amount,
  currency: payment.currency,
  status: payment.status,
  createdAt: payment.createdAt,
});

// ─── POST /api/payments/create-order ─────────────────────────────────────────

// @desc    Create a Razorpay order and a pending Payment record
// @route   POST /api/payments/create-order
// @body    { amount: Number (major units, e.g. rupees), currency?: String }
// @access  Private
const createOrder = async (req, res) => {
  try {
    const { amount, currency = 'INR' } = req.body;

    // ── Validate amount ──
    // Reject anything that isn't a finite positive number. Cap at a sane
    // upper bound to avoid typos like sending paise instead of rupees.
    const numericAmount = Number(amount);
    if (
      amount === undefined ||
      amount === null ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      return res
        .status(400)
        .json({ success: false, message: 'Amount must be a positive number' });
    }
    if (numericAmount > 500000) {
      return res
        .status(400)
        .json({ success: false, message: 'Amount exceeds the maximum allowed per order' });
    }

    // ── Validate currency ──
    const normalizedCurrency = String(currency).toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(normalizedCurrency)) {
      return res.status(400).json({
        success: false,
        message: `Currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
      });
    }

    // Razorpay amounts are in the smallest currency unit (paise for INR, cents for USD)
    const amountInSubunits = Math.round(numericAmount * 100);

    const razorpay = getRazorpayInstance();
    const order = await razorpay.orders.create({
      amount: amountInSubunits,
      currency: normalizedCurrency,
      // Receipt must be <= 40 chars for Razorpay
      receipt: `rcpt_${req.user._id.toString().slice(-8)}_${Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
      },
    });

    // Persist a "created" record up-front so the webhook has something to
    // match against even if the user never completes checkout.
    const payment = await Payment.create({
      userId: req.user._id,
      orderId: order.id,
      amount: numericAmount,
      currency: normalizedCurrency,
      status: 'created',
    });

    res.status(201).json({
      success: true,
      orderId: order.id,
      amount: numericAmount,
      currency: normalizedCurrency,
      paymentRecordId: payment._id,
    });
  } catch (err) {
    if (err.message && err.message.startsWith('Razorpay is not configured')) {
      console.error('createOrder error:', err.message);
      return res.status(500).json({ success: false, message: 'Payment gateway is not configured' });
    }
    // Extremely unlikely (Razorpay order ids are already unique), but guard
    // the unique index anyway in case of a freak collision/race.
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate order — please retry' });
    }
    console.error('createOrder error:', err);
    res.status(500).json({ success: false, message: 'Could not create order' });
  }
};

// ─── POST /api/payments/verify ───────────────────────────────────────────────

// @desc    Verify a Razorpay checkout signature and mark the order successful.
//          This gives the client immediate feedback, but the webhook
//          (handled separately, server-to-server) remains the source of
//          truth — this endpoint never trusts client-supplied status alone,
//          it independently recomputes and checks the HMAC signature.
// @route   POST /api/payments/verify
// @body    { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// @access  Private
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required',
      });
    }
    if (
      typeof razorpay_order_id !== 'string' ||
      typeof razorpay_payment_id !== 'string' ||
      typeof razorpay_signature !== 'string'
    ) {
      return res.status(400).json({ success: false, message: 'Invalid payload types' });
    }

    const payment = await Payment.findOne({ orderId: razorpay_order_id });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Only the user who created the order can verify it
    if (payment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized for this order' });
    }

    // ── Signature check — never trust the client's claimed outcome ──
    const isValid = verifyOrderPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      // Don't flip an already-successful record to failed on a bad
      // verify call (could be a replay/tamper attempt) — only record
      // failure if it isn't already marked successful by the webhook.
      if (payment.status !== 'success') {
        payment.status = 'failed';
        payment.failureReason = 'Signature verification failed';
        await payment.save();
      }
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // Idempotent: if the webhook already marked this successful, just return success
    if (payment.status !== 'success') {
      payment.paymentId = razorpay_payment_id;
      payment.status = 'success';
      payment.failureReason = null;
      await payment.save();

      await applyPremiumOnSuccess(payment.userId, razorpay_payment_id);
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      payment: safePayment(payment),
    });
  } catch (err) {
    console.error('verifyPayment error:', err);
    res.status(500).json({ success: false, message: 'Could not verify payment' });
  }
};

// ─── Business logic ──────────────────────────────────────────────────────────

/**
 * Mark a user as premium after a successful payment.
 * Kept separate so both the /verify endpoint and the webhook can call it
 * without duplicating logic. Idempotent — safe to call repeatedly.
 */
const applyPremiumOnSuccess = async (userId, paymentId) => {
  try {
    await User.findByIdAndUpdate(userId, { isPremium: true });

    // ── Queue payment notification (Slice 11) — fire-and-forget ──
    addNotificationJob('payment', {
      userId:      userId.toString(),
      type:        'payment',
      message:     'Your payment was successful! You are now a Premium member.',
      referenceId: paymentId || null,
    }).catch((err) => console.error('[Payment] notification job error:', err.message));
  } catch (err) {
    // Never let a premium-flag failure break payment processing/ack —
    // log loudly so it can be reconciled manually.
    console.error(`applyPremiumOnSuccess failed for user ${userId}:`, err.message);
  }
};

// ─── POST /api/payments/webhook ──────────────────────────────────────────────

// @desc    Razorpay server-to-server webhook. Source of truth for payment
//          status — verified against the RAW request body, independent of
//          anything the client claims.
// @route   POST /api/payments/webhook
// @access  Public (signature-verified, not user-authenticated)
const handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('handleWebhook error: RAZORPAY_WEBHOOK_SECRET is not set');
      return res.status(500).json({ success: false, message: 'Webhook is not configured' });
    }

    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing webhook signature' });
    }

    // req.body is the RAW Buffer here (see express.raw() mount in app.js) —
    // required because Razorpay signs the exact raw bytes it sent us.
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      console.error('handleWebhook error: raw body not available — check app.js route mounting');
      return res.status(500).json({ success: false, message: 'Server misconfiguration' });
    }

    const isValid = Razorpay.validateWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    const eventType = event.event;
    const paymentEntity = event?.payload?.payment?.entity;

    if (!paymentEntity) {
      // Acknowledge events we don't care about so Razorpay doesn't retry them
      return res.status(200).json({ success: true, message: 'Event ignored' });
    }

    const { order_id: orderId, id: paymentId, error_description } = paymentEntity;

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      // Order wasn't created through our API (or already pruned) — nothing
      // to update. Still ack with 200 so Razorpay stops retrying.
      console.warn(`handleWebhook: no Payment record for orderId ${orderId}`);
      return res.status(200).json({ success: true, message: 'No matching order' });
    }

    // ── Idempotency ──
    // A payment that's already settled to a terminal, matching state should
    // not be reprocessed — webhooks can and do arrive more than once.
    if (eventType === 'payment.captured') {
      if (payment.status === 'success' && payment.lastWebhookEvent === eventType) {
        return res.status(200).json({ success: true, message: 'Already processed' });
      }

      payment.paymentId = paymentId;
      payment.status = 'success';
      payment.failureReason = null;
      payment.lastWebhookEvent = eventType;
      await payment.save();

      await applyPremiumOnSuccess(payment.userId, payment.paymentId);
    } else if (eventType === 'payment.failed') {
      if (payment.status === 'failed' && payment.lastWebhookEvent === eventType) {
        return res.status(200).json({ success: true, message: 'Already processed' });
      }

      // Don't downgrade a payment the system already confirmed as successful
      // (e.g. a late/duplicate failed event arriving after capture).
      if (payment.status !== 'success') {
        payment.paymentId = paymentId;
        payment.status = 'failed';
        payment.failureReason = error_description || 'Payment failed';
        payment.lastWebhookEvent = eventType;
        await payment.save();
      }
    } else {
      // Other event types (order.paid, refund.*, etc.) — not handled in
      // this slice, just acknowledge so Razorpay doesn't keep retrying.
      return res.status(200).json({ success: true, message: 'Event type not handled' });
    }

    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (err) {
    console.error('handleWebhook error:', err);
    // 500 here is intentional — Razorpay will retry, which is what we want
    // if something failed transiently (e.g. DB blip).
    res.status(500).json({ success: false, message: 'Webhook processing error' });
  }
};

module.exports = { createOrder, verifyPayment, handleWebhook };
