require("dotenv").config()
const app = require("./src/app")
const connectToDB = require("./src/config/db")
const redisClient = require("./src/config/redis")
require("./src/workers/email.worker") 
require("./src/workers/snapshot.worker") 
const { scheduleDailyAudit } = require("./src/workers/audit.worker")

async function startServer() {
    await connectToDB()
    await scheduleDailyAudit()

    await redisClient.connect()

    app.listen(process.env.PORT , () => {
        console.log(`Server is running on port ${process.env.PORT}`)
    })
}

startServer();