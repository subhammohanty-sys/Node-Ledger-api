const userModel = require("../models/user.model")
const jwt = require("jsonwebtoken")
const emailService = require("../services/email.service")
const redisClient = require("../config/redis")

/**
* - user register controller
* - POST /api/auth/register
*/
async function userRegisterController(req, res) {
    try {
        const { email, password, name } = req.body

        const isExists = await userModel.findOne({
            email: email
        })

        if (isExists) {
            return res.status(422).json({
                message: "User already exists with email.",
                status: "failed"
            })
        }

        const user = await userModel.create({
            email, password, name
        })

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "3d" })

        res.cookie("token", token)

        res.status(201).json({
            user: {
                _id: user._id,
                email: user.email,
                name: user.name
            },
            token
        })

        try {
            await emailService.sendRegistrationEmail(user.email, user.name)
        } catch (emailErr) {
            console.error("Failed to send registration email:", emailErr.message)
        }
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error during registration",
            error: error.message
        })
    }
}

/**
 * - User Login Controller
 * - POST /api/auth/login
  */

async function userLoginController(req, res) {
    try {
        const { email, password } = req.body

        const user = await userModel.findOne({ email }).select("+password")

        if (!user) {
            return res.status(401).json({
                message: "Email or password is INVALID"
            })
        }

        const isValidPassword = await user.comparePassword(password)

        if (!isValidPassword) {
            return res.status(401).json({
                message: "Email or password is INVALID"
            })
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "3d" })

        res.cookie("token", token)

        res.status(200).json({
            user: {
                _id: user._id,
                email: user.email,
                name: user.name
            },
            token
        })
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error during login",
            error: error.message
        })
    }
}


/**
 * - User Logout Controller
 * - POST /api/auth/logout
  */
async function userLogoutController(req, res) {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(" ")[1]

        if (!token) {
            return res.status(200).json({
                message: "User logged out successfully"
            })
        }


        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
            const currentTime = Math.floor(Date.now() / 1000);
            const timeUntilExpiry = decoded.exp - currentTime;

            if (timeUntilExpiry > 0) {

                await redisClient.set(`blacklist:${token}`, "blacklisted", "EX", timeUntilExpiry);
            }
        }

        res.clearCookie("token")

        res.status(200).json({
            message: "User logged out successfully"
        })
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error during logout",
            error: error.message
        })
    }

}


module.exports = {
    userRegisterController,
    userLoginController,
    userLogoutController
}