/**
 * auth.swagger.js — OpenAPI definitions for /auth/* routes.
 * No route logic here — this file only exists to be scanned by swagger-jsdoc.
 */

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: Jane Doe }
 *               email: { type: string, format: email, example: jane@example.com }
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Min 8 chars, at least 1 uppercase letter and 1 number
 *                 example: Sup3rSecret
 *     responses:
 *       201:
 *         description: User created — access token issued (login separately for a refresh token)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 accessToken: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     email: { type: string }
 *                     isPremium: { type: boolean }
 *                     createdAt: { type: string, format: date-time }
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     description: >
 *       Returns an access token in the response body and sets a long-lived
 *       refresh token as an HTTP-only cookie (`refreshToken`). The refresh
 *       token is also returned in the body for Postman/curl convenience.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 accessToken: { type: string }
 *                 refreshToken: { type: string }
 *                 user: { type: object }
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange a refresh token for a new access token (rotates the refresh token)
 *     description: >
 *       Accepts the refresh token from the `refreshToken` HTTP-only cookie,
 *       or from the request body (useful for Postman/curl clients that
 *       can't easily replay cookies).
 *     security: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string, description: Only needed if not sent via cookie }
 *     responses:
 *       200:
 *         description: New access + refresh token issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 accessToken: { type: string }
 *                 refreshToken: { type: string }
 *       401:
 *         description: Refresh token missing, invalid, or expired
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out the current session (invalidates this device's refresh token)
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Logged out successfully }
 *       401:
 *         description: Missing or invalid access token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *
 * /auth/github:
 *   get:
 *     tags: [Auth]
 *     summary: Redirect to GitHub's OAuth authorization page
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to github.com/login/oauth/authorize
 *
 * /auth/github/callback:
 *   get:
 *     tags: [Auth]
 *     summary: GitHub OAuth callback — exchanges code for token, issues app JWT
 *     security: []
 *     parameters:
 *       - in: query
 *         name: code
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *     responses:
 *       302:
 *         description: Redirects back to the frontend with tokens attached
 */
