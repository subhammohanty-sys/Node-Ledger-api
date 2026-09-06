require("dotenv").config()
const app = require("./src/app")
const connectToDB = require("./src/config/db")
const redisClient = require("./src/config/redis")
require("./src/workers/email.worker") // Start the background email worker

async function startServer() {
    await connectToDB()

    app.listen(3000, () => {
        console.log("Server is running on port 3000")
    })
}

startServer();