const express = require("express")
const cookieParser = require("cookie-parser")
import cors from "cors"
import helmet from "helmet"


const app = express()

app.use(cors({
    origin: "http://localhost:5173", // Replace with your frontend URL
    credentials: true, 
}))
app.use(helmet())
app.use(express.json())
app.use(cookieParser())

/**
 * - Routes required
 */
const authRouter = require("./routes/auth.routes")
const accountRouter = require("./routes/account.routes")
const transactionRoutes = require("./routes/transaction.routes")
const idempotencykeyRoutes = require("./routes/idempotencykey.routes")

/**
 * - Use Routes
 */

app.get("/", (req, res) => {
    res.send("Ledger Service is up and running")
})

app.use("/api/auth", authRouter)
app.use("/api/accounts", accountRouter)
app.use("/api/transactions", transactionRoutes)
app.use("/api/idempotency-key", idempotencykeyRoutes)

module.exports = app