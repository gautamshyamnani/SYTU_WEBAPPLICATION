/**
 * notifications.swagger.js — OpenAPI definitions for /notifications/* routes.
 * No route logic here — this file only exists to be scanned by swagger-jsdoc.
 */

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notifications for the logged-in user, newest first
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: unreadOnly
 *         schema: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: Notification list (unreadCount reflects ALL unread, regardless of filter)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 unreadCount: { type: integer }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pages: { type: integer }
 *                 notifications:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       type: { type: string }
 *                       message: { type: string }
 *                       isRead: { type: boolean }
 *                       referenceId: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *
 * /notifications/read-all:
 *   put:
 *     tags: [Notifications]
 *     summary: Mark all unread notifications as read
 *     responses:
 *       200:
 *         description: Updated count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 updatedCount: { type: integer }
 *
 * /notifications/{id}/read:
 *   put:
 *     tags: [Notifications]
 *     summary: Mark a single notification as read
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 notification: { type: object }
 *       404:
 *         description: Notification not found (or not owned by this user)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *
 * /notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete a single notification
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *       404:
 *         description: Notification not found (or not owned by this user)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
