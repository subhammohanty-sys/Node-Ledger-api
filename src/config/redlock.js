const Redlock = require("redlock");
const redisClient = require("./redis");

// Initialize Redlock with our existing Redis client
const redlock = new Redlock(
    // You should have one client for each independent redis node or cluster.
    [redisClient],
    {
        driftFactor: 0.01, // time in ms

        // the max number of times Redlock will attempt to lock a resource before erroring
        retryCount: 10,

        // the time in ms between attempts
        retryDelay: 200, // time in ms

        // the max time in ms randomly added to retries to improve performance under high contention
        retryJitter: 200 // time in ms
    }
);

redlock.on("clientError", function (err) {
    console.error("A redis error has occurred on the redlock client:", err);
});

module.exports = redlock;
