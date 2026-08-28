const { Router } = require('express');
const idempotencykeyController = require('../controllers/idempotencykey.controller');
const authMiddleware = require('../middleware/auth.middleware');

const idempotencykeyRoutes = Router();

/**
 * - GET /api/idempotency-key
 * - Generate a new idempotency key
 */

idempotencykeyRoutes.get('/', authMiddleware.authMiddleware, idempotencykeyController.generateIdempotencyKey);

module.exports = idempotencykeyRoutes;
