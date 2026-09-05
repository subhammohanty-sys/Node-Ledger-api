const redisClient = require('../config/redis')

async function rateLimiter(req, res, next) {
    const ip = req.ip;
    const windowInSeconds = 60 * 1;
    const maxRequest = 10;

    try {

        const rateKey = `rate_limit:${ip}`;

        const requestCount = await redisClient.incr(rateKey);

        if (requestCount > maxRequest) {
            return res.status(429).json({
                message: "Too many requests, please try again later"
            });
        }

        if (requestCount === 1) {
            await redisClient.expire(rateKey, windowInSeconds);
        }

        next();

    } catch (error) {
        console.error("Rate limiter error:", error);
        next();
    }

}

module.exports = { rateLimiter };