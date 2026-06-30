/**
 * connections.swagger.js — OpenAPI definitions for /connections/* and /discovery routes.
 * No route logic here — this file only exists to be scanned by swagger-jsdoc.
 */

/**
 * @openapi
 * /connections/send/{userId}:
 *   post:
 *     tags: [Connections]
 *     summary: Send a connection request to another user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Connection request created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Connection request sent }
 *                 connection: { type: object }
 *       400:
 *         description: Invalid user ID or sending to self
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       409:
 *         description: Already connected or a request is already pending
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *
 * /connections/respond/{requestId}:
 *   put:
 *     tags: [Connections]
 *     summary: Accept or reject an incoming connection request
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action: { type: string, enum: [accepted, rejected] }
 *     responses:
 *       200:
 *         description: Request updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 connection: { type: object }
 *       403:
 *         description: Not authorized to respond to this request
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       404:
 *         description: Connection request not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *
 * /connections/requests:
 *   get:
 *     tags: [Connections]
 *     summary: Get incoming pending connection requests
 *     responses:
 *       200:
 *         description: List of pending requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 count: { type: integer }
 *                 requests:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       requestId: { type: string }
 *                       status: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *                       sender: { type: object }
 *
 * /connections/list:
 *   get:
 *     tags: [Connections]
 *     summary: Get all accepted connections for the logged-in user
 *     responses:
 *       200:
 *         description: List of connections
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 count: { type: integer }
 *                 connections:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       connectionId: { type: string }
 *                       connectedAt: { type: string, format: date-time }
 *                       user: { type: object }
 *
 * /discovery:
 *   get:
 *     tags: [Discovery]
 *     summary: Get a ranked list of users to potentially connect with
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200:
 *         description: Ranked discovery feed (cached 60s per user)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 count: { type: integer }
 *                 limit: { type: integer }
 *                 fromCache: { type: boolean }
 *                 users: { type: array, items: { type: object } }
 */
