const mongoose = require("mongoose")
const ledgerModel = require("./ledger.model")
const redisClient = require("../config/redis")
const snapshotModel = require('./snapshot.model');

const accountSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "Account must be associated with a user"],
        index: true
    },
    status: {
        type: String,
        enum: {
            values: ["ACTIVE", "FROZEN", "CLOSED"],
            message: "Status can be either ACTIVE, FROZEN or CLOSED",
        },
        default: "ACTIVE"
    },
    currency: {
        type: String,
        required: [true, "Currency is required for creating an account"],
        default: "INR"
    }
}, {
    timestamps: true
})

accountSchema.index({ user: 1, status: 1 })

accountSchema.methods.getBalance = async function () {
    const cacheKey = `balance:${this._id}`;

    const cachedBalance = await redisClient.get(cacheKey);
    if (cachedBalance !== null) {
        return parseFloat(cachedBalance);
    }
    // Cache Miss: Use Snapshot Rollup Algorithm
    const latestSnapshot = await snapshotModel.findOne({ account: this._id }).sort({ createdAt: -1 });

    const matchQuery = { account: this._id };
    let baseBalance = 0;

    // If a snapshot exists, we only query ledger entries that happened AFTER the snapshot
    if (latestSnapshot) {
        matchQuery._id = { $gt: latestSnapshot.lastLedgerId };
        baseBalance = latestSnapshot.balance;
    }

    const balanceData = await ledgerModel.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: null,
                totalDebit: {
                    $sum: {
                        $cond: [
                            { $eq: ["$type", "DEBIT"] },
                            "$amount",
                            0
                        ]
                    }
                },
                totalCredit: {
                    $sum: {
                        $cond: [
                            { $eq: ["$type", "CREDIT"] },
                            "$amount",
                            0
                        ]
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                balance: { $subtract: ["$totalCredit", "$totalDebit"] }
            }
        }
    ]);

    const newLedgerBalance = balanceData.length === 0 ? 0 : balanceData[0].balance;
    const calculatedBalance = baseBalance + newLedgerBalance;

    await redisClient.set(cacheKey, calculatedBalance, "EX", 1800);

    return calculatedBalance;
}


const accountModel = mongoose.model("account", accountSchema)



module.exports = accountModel