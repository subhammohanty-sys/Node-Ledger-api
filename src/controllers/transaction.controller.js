const transactionModel = require("../models/transaction.model")
const ledgerModel = require("../models/ledger.model")
const accountModel = require("../models/account.model")
const emailQueue = require("../queues/email.queue")
const mongoose = require("mongoose")
const IdempotencyKey = require("../models/idempotencyKey.model")
const redisClient = require("../config/redis")
const redlock = require("../config/redlock")
const snapshotQueue = require("../queues/snapshot.queue")

/**
 * Executes a fund transfer between two accounts using double-entry bookkeeping,
 * distributed locking to prevent overdrafts, and atomic database transactions.
 */
async function createTransaction(req, res) {
    try {
        const { fromAccount, toAccount, amount, idempotencyKey } = req.body

        if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
            return res.status(400).json({
                message: "FromAccount, toAccount, amount and idempotencyKey are required"
            })
        }

        const fromUserAccount = await accountModel.findOne({
            _id: fromAccount,
        })

        const toUserAccount = await accountModel.findOne({
            _id: toAccount,
        })

        if (!fromUserAccount || !toUserAccount) {
            return res.status(400).json({
                message: "Invalid fromAccount or toAccount"
            })
        }

        if (fromUserAccount.status !== "ACTIVE" || toUserAccount.status !== "ACTIVE") {
            return res.status(400).json({
                message: "Both fromAccount and toAccount must be ACTIVE to process transaction"
            })
        }

        // Sort lock keys deterministically to avoid deadlocks in concurrent transfers
        const locks = [`lock:account:${fromAccount}`, `lock:account:${toAccount}`].sort();

        try {
            await redlock.using(locks, 5000, async (signal) => {
                const balance = await fromUserAccount.getBalance()

                if (balance < amount) {
                    throw new Error(`Insufficient balance. Current balance is ${balance}. Requested amount is ${amount}`)
                }

                // Atomic transaction: create pending transaction and double-entry ledger records
                const session = await mongoose.startSession();
                session.startTransaction()
                let transaction;

                try {
                    transaction = (await transactionModel.create([{
                        fromAccount,
                        toAccount,
                        amount,
                        idempotencyKey,
                        status: "PENDING"
                    }], { session }))[0]

                    const debitLedgerEntry = await ledgerModel.create([{
                        account: fromAccount,
                        amount: amount,
                        transaction: transaction._id,
                        type: "DEBIT"
                    }], { session })

                    const creditLedgerEntry = await ledgerModel.create([{
                        account: toAccount,
                        amount: amount,
                        transaction: transaction._id,
                        type: "CREDIT"
                    }], { session })

                    await transactionModel.findOneAndUpdate(
                        { _id: transaction._id },
                        { status: "COMPLETED" },
                        { session }
                    )

                    transaction.status = "COMPLETED"
                    await transaction.save({ session })

                    await session.commitTransaction();
                    session.endSession();

                    // Invalidate cached balances to force recalculation on next read
                    await redisClient.del(`balance:${fromAccount}`);
                    await redisClient.del(`balance:${toAccount}`);

                    // Trigger async background snapshot and reconciliation check
                    await snapshotQueue.add('check', { accountId: fromAccount });
                    await snapshotQueue.add('check', { accountId: toAccount });
                } catch (error) {
                    await session.abortTransaction();
                    session.endSession();
                    throw new Error("Transaction is pending due to an issue, please retry after some time: " + error.message)
                }

                req.completedTransaction = transaction;
            });
        } catch (error) {
            return res.status(400).json({
                message: error.message || "Could not acquire lock to process transaction"
            })
        }

        // Asynchronously enqueue customer email notification
        try {
            await emailQueue.add('transaction', {
                email: req.user.email,
                name: req.user.name,
                amount, toAccount
            },
                {
                    attempts: 3,
                    backoff: {
                        type: 'fixed',
                        delay: 5000
                    }
                }
            )
        } catch (queueErr) {
            console.error("Failed to enqueue transaction email", queueErr)
        }

        const responseObj = {
            message: "Transaction completed successfully",
            transaction: req.completedTransaction
        };

        // Cache completed response payload for idempotent retries
        if (idempotencyKey) {
            await IdempotencyKey.findOneAndUpdate(
                { key: idempotencyKey },
                { status: 'completed', responseBody: responseObj }
            );
        }

        return res.status(200).json(responseObj)
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error during transaction processing",
            error: error.message
        })
    }
}

/**
 * Credits initial funding to a newly created user account from the system account.
 */
async function createInitialFundsTransaction(req, res) {
    try {
        const { toAccount, amount, idempotencyKey } = req.body

        if (!toAccount || !amount || !idempotencyKey) {
            return res.status(400).json({
                message: "toAccount, amount and idempotencyKey are required"
            })
        }

        const toUserAccount = await accountModel.findOne({
            _id: toAccount,
        })

        if (!toUserAccount) {
            return res.status(400).json({
                message: "Invalid toAccount"
            })
        }

        const fromUserAccount = await accountModel.findOne({
            user: req.user._id
        })

        if (!fromUserAccount) {
            return res.status(400).json({
                message: "System user account not found"
            })
        }

        // Atomic transaction: mint initial ledger entries
        const session = await mongoose.startSession();
        session.startTransaction();
        let transaction;

        try {
            transaction = new transactionModel({
                fromAccount: fromUserAccount._id,
                toAccount,
                amount,
                idempotencyKey,
                status: "PENDING"
            })

            const debitLedgerEntries = await ledgerModel.create([{
                account: fromUserAccount._id,
                amount: amount,
                transaction: transaction._id,
                type: "DEBIT"
            }], { session })

            const creditLedgerEntries = await ledgerModel.create([{
                account: toAccount,
                amount: amount,
                transaction: transaction._id,
                type: "CREDIT"
            }], { session })

            transaction.status = "COMPLETED"
            await transaction.save({ session })

            await session.commitTransaction();
            session.endSession();

            // Invalidate cached balances
            await redisClient.del(`balance:${fromUserAccount._id.toString()}`);
            await redisClient.del(`balance:${toAccount}`);

            // Enqueue snapshot check
            await snapshotQueue.add('check', { accountId: fromUserAccount._id.toString() });
            await snapshotQueue.add('check', { accountId: toAccount });

            const responseObj = {
                message: "Initial funds transaction completed successfully",
                transaction: transaction
            };

            // Cache response for idempotent retries
            if (idempotencyKey) {
                await IdempotencyKey.findOneAndUpdate(
                    { key: idempotencyKey },
                    { status: 'completed', responseBody: responseObj }
                );
            }

            return res.status(201).json(responseObj)
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                message: "Transaction failed",
                error: error.message
            })
        }
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error during initial funds transaction",
            error: error.message
        })
    }
}

module.exports = {
    createTransaction,
    createInitialFundsTransaction
}
