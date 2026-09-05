const express = require("express")
const authController = require("../controllers/auth.controller")
const rate_limit = require("../middleware/ratelimiter.middleware")

const router = express.Router()


/* POST /api/auth/register */
router.post("/register", rate_limit.rateLimiter, authController.userRegisterController)


/* POST /api/auth/login */
router.post("/login", rate_limit.rateLimiter, authController.userLoginController)

/**
 * - POST /api/auth/logout
 */
router.post("/logout", rate_limit.rateLimiter, authController.userLogoutController)



module.exports = router