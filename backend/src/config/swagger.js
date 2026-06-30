/**
 * swagger.js — OpenAPI 3.0 spec generation (swagger-jsdoc)
 *
 * Reads JSDoc-style @openapi blocks from src/docs/*.swagger.js and builds
 * a spec object. Mounted in app.js via swagger-ui-express at GET /api/docs.
 *
 * Route definitions live in src/docs/ rather than inline in src/routes/ so
 * existing route files stay untouched — zero risk of breaking working logic.
 */

const swaggerJSDoc = require('swagger-jsdoc');
const path = require('path');

const PORT = process.env.PORT || 5000;

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Auth Backend API',
    version: '1.0.0',
    description:
      'MERN backend — authentication, profiles, connections, discovery, ' +
      'chat, payments, GitHub OAuth, notifications, and search.\n\n' +
      'All endpoints are available under both `/api/*` (legacy) and ' +
      '`/api/v1/*` (versioned) — they are the same routers mounted twice.',
  },
  servers: [
    { url: `http://localhost:${PORT}/api`, description: 'Local (legacy prefix)' },
    { url: `http://localhost:${PORT}/api/v1`, description: 'Local (v1 prefix)' },
  ],
  tags: [
    { name: 'Health', description: 'Service health / readiness' },
    { name: 'Auth', description: 'Registration, login, token refresh, logout, GitHub OAuth' },
    { name: 'User', description: 'Profile read/update, user search' },
    { name: 'Connections', description: 'Send/accept/reject connection requests' },
    { name: 'Discovery', description: 'Ranked user discovery feed' },
    { name: 'Messages', description: 'Direct-message chat history (live messaging is via Socket.IO)' },
    { name: 'Payments', description: 'Razorpay order creation, verification, and webhook' },
    { name: 'GitHub', description: 'Linked GitHub account repo sync/status' },
    { name: 'Notifications', description: 'In-app notification feed' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Send the access token as: Authorization: Bearer <accessToken>',
      },
    },
    schemas: {
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Server error' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const options = {
  swaggerDefinition,
  // Glob patterns swagger-jsdoc scans for @openapi / @swagger comment blocks.
  apis: [path.join(__dirname, '..', 'docs', '*.swagger.js')],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
