/**
 * payments.swagger.js — OpenAPI definitions for /payments/* routes.
 * No route logic here — this file only exists to be scanned by swagger-jsdoc.
 */

/**
 * @openapi
 * /payments/create-order:
 *   post:
 *     tags: [Payments]
 *     summary: Create a Razorpay order and a pending Payment record
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Major currency units (e.g. rupees), max 500000
 *                 example: 499
 *               currency:
 *                 type: string
 *                 enum: [INR, USD]
 *                 default: INR
 *     responses:
 *       201:
 *         description: Razorpay order created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 order:
 *                   type: object
 *                   properties:
 *                     id: { type: string, example: order_Hd92xz8Kj8sjQ }
 *                     amount: { type: integer, description: Smallest currency unit (paise/cents) }
 *                     currency: { type: string }
 *       400:
 *         description: Invalid amount or currency
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *
 * /payments/verify:
 *   post:
 *     tags: [Payments]
 *     summary: Verify a Razorpay checkout signature
 *     description: >
 *       Gives the client immediate feedback. The webhook remains the
 *       source of truth — this endpoint independently recomputes and
 *       checks the HMAC signature rather than trusting the client.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpay_order_id, razorpay_payment_id, razorpay_signature]
 *             properties:
 *               razorpay_order_id: { type: string }
 *               razorpay_payment_id: { type: string }
 *               razorpay_signature: { type: string }
 *     responses:
 *       200:
 *         description: Payment verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 payment: { type: object }
 *       400:
 *         description: Missing/invalid payload or signature mismatch
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Not authorized for this order
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *
 * /payments/webhook:
 *   post:
 *     tags: [Payments]
 *     summary: Razorpay server-to-server webhook
 *     description: >
 *       Public endpoint — authenticity is verified via the
 *       `X-Razorpay-Signature` header (HMAC against the raw request body),
 *       not via JWT. This is the source of truth for final payment status.
 *       Configure this URL in the Razorpay Dashboard › Settings › Webhooks.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Raw Razorpay webhook payload
 *     responses:
 *       200:
 *         description: Webhook processed
 *       400:
 *         description: Invalid signature
 */
