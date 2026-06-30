/**
 * github.swagger.js — OpenAPI definitions for /github/* routes.
 * No route logic here — this file only exists to be scanned by swagger-jsdoc.
 */

/**
 * @openapi
 * /github/status:
 *   get:
 *     tags: [GitHub]
 *     summary: Get the logged-in user's GitHub connection status
 *     responses:
 *       200:
 *         description: Linked status, username, repo count, last sync time
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 linked: { type: boolean }
 *                 githubUsername: { type: string, nullable: true }
 *                 repoCount: { type: integer }
 *                 lastSyncedAt: { type: string, format: date-time, nullable: true }
 *
 * /github/repos:
 *   get:
 *     tags: [GitHub]
 *     summary: Get the logged-in user's synced repos
 *     description: >
 *       Returns previously-synced repos from the DB. Pass `fresh=true` to
 *       force an inline re-sync before responding (slower, always fresh).
 *       Otherwise use `POST /github/sync` for a background refresh.
 *     parameters:
 *       - in: query
 *         name: fresh
 *         schema: { type: boolean, default: false }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [stars, forks, updated, name] }
 *       - in: query
 *         name: lang
 *         schema: { type: string }
 *         description: Filter by programming language
 *     responses:
 *       200:
 *         description: Paginated repo list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 repos: { type: array, items: { type: object } }
 *       400:
 *         description: No GitHub account linked
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       401:
 *         description: GitHub token missing or invalid — re-authenticate
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *
 * /github/sync:
 *   post:
 *     tags: [GitHub]
 *     summary: Enqueue a background GitHub repo sync job
 *     description: Returns immediately with 202 Accepted. Poll GET /github/repos afterward.
 *     responses:
 *       202:
 *         description: Sync job enqueued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: GitHub sync job enqueued }
 *       400:
 *         description: No GitHub account linked
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
