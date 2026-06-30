/**
 * health.swagger.js — OpenAPI definitions for the health-check endpoint.
 * No route logic here — this file only exists to be scanned by swagger-jsdoc.
 */

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Liveness / readiness probe
 *     security: []
 *     responses:
 *       200:
 *         description: Service is up
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 uptime: { type: number, example: 123.45, description: Process uptime in seconds }
 *                 timestamp: { type: string, format: date-time }
 *                 services:
 *                   type: object
 *                   properties:
 *                     mongo: { type: string, example: connected }
 *                     redis: { type: string, example: connected }
 */
