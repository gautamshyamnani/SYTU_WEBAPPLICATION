/**
 * user.swagger.js — OpenAPI definitions for /user/* and /users/* routes.
 * No route logic here — this file only exists to be scanned by swagger-jsdoc.
 */

/**
 * @openapi
 * /user/me:
 *   get:
 *     tags: [User]
 *     summary: Get the logged-in user's full profile
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     email: { type: string }
 *                     username: { type: string, nullable: true }
 *                     bio: { type: string }
 *                     skills: { type: array, items: { type: string } }
 *                     profilePicture: { type: string }
 *                     location: { type: string }
 *                     isProfileComplete: { type: boolean }
 *                     isPremium: { type: boolean }
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *       401:
 *         description: Missing or invalid access token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *
 * /user/update:
 *   put:
 *     tags: [User]
 *     summary: Update profile fields
 *     description: Only `username`, `bio`, `skills`, `location`, `profilePicture` may be updated.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string, example: jane_doe }
 *               bio: { type: string, maxLength: 300 }
 *               skills: { type: array, items: { type: string }, maxItems: 20 }
 *               location: { type: string, maxLength: 100 }
 *               profilePicture: { type: string, format: uri }
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 user: { type: object }
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       409:
 *         description: Username already taken
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *
 * /users/search:
 *   get:
 *     tags: [User]
 *     summary: Search and filter users with pagination
 *     description: Rate-limited to 30 requests / 60s per authenticated user.
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Partial, case-insensitive match on username or skills
 *       - in: query
 *         name: location
 *         schema: { type: string }
 *         description: Partial, case-insensitive match
 *       - in: query
 *         name: skills
 *         schema: { type: string }
 *         description: Comma-separated exact skill names, e.g. react,node
 *       - in: query
 *         name: isProfileComplete
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200:
 *         description: Paginated, ranked search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 *                 total: { type: integer }
 *                 truncated: { type: boolean }
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId: { type: string }
 *                       name: { type: string }
 *                       username: { type: string, nullable: true }
 *                       bio: { type: string }
 *                       skills: { type: array, items: { type: string } }
 *                       location: { type: string }
 *                       matchScore: { type: number }
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
