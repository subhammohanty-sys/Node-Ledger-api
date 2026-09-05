const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const transactionController = require("../controllers/transaction.controller")
const idempotencyMiddleware = require("../middleware/idempotency.middleware")
const rate_limit = require("../middleware/ratelimiter.middleware")

const transactionRoutes = Router();

/**
 * - POST /api/transactions/
 * - Create a new transaction
 */

transactionRoutes.post("/", rate_limit.rateLimiter, authMiddleware.authMiddleware, idempotencyMiddleware.verifyIdempotencyKey, transactionController.createTransaction)


/**
 * - POST /api/transactions/system/initial-funds
 * - Create initial funds transaction from system user
 */
transactionRoutes.post("/system/initial-funds", rate_limit.rateLimiter, authMiddleware.authSystemUserMiddleware, idempotencyMiddleware.verifyIdempotencyKey, transactionController.createInitialFundsTransaction)

module.exports = transactionRoutes;