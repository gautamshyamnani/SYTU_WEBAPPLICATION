/**
 * messages.swagger.js — OpenAPI definitions for /messages/* routes.
 * No route logic here — this file only exists to be scanned by swagger-jsdoc.
 *
 * Note: live message sending happens over Socket.IO (event `message:send`),
 * not REST — this route only exposes historical chat retrieval.
 */

/**
 * @openapi
 * /messages/{userId}:
 *   get:
 *     tags: [Messages]
 *     summary: Get chat history with another user
 *     description: >
 *       Returns the conversation between the logged-in user and `userId`,
 *       oldest-to-newest. Requires an accepted connection between both
 *       users. Cursor-based pagination — pass `before` as the oldest
 *       `_id` from the previous page to fetch older messages. Real-time
 *       message delivery and typing indicators are handled over Socket.IO
 *       (`message:send`, `typing:start`, `typing:stop`), not this endpoint.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 100 }
 *       - in: query
 *         name: before
 *         schema: { type: string }
 *         description: A message _id — returns messages older than this one
 *     responses:
 *       200:
 *         description: Chat history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 count: { type: integer }
 *                 hasMore: { type: boolean }
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sender: { type: string }
 *                       receiver: { type: string }
 *                       message: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *       400:
 *         description: Invalid user ID
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Not connected with this user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
