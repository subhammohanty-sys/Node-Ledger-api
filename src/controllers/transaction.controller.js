const transactionModel = require("../models/transaction.model")
const ledgerModel = require("../models/ledger.model")
const accountModel = require("../models/account.model")
const emailQueue = require("../queues/email.queue")
const mongoose = require("mongoose")
const IdempotencyKey = require("../models/idempotencyKey.model")


/**
 * - Create a new transaction
 * THE 10-STEP TRANSFER FLOW:
     * 1. Validate request
     * 2. Validate idempotency key
     * 3. Check account status
     * 4. Derive sender balance from ledger
     * 5. Create transaction (PENDING)
     * 6. Create DEBIT ledger entry
     * 7. Create CREDIT ledger entry
     * 8. Mark transaction COMPLETED
     * 9. Commit MongoDB session
     * 10. Send email notification
 */

async function createTransaction(req, res) {
    try {
        /**
         * 1. Validate request
         */
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

        /**
         * 2. Validate idempotency key
         * (Note: This is now handled automatically by the idempotency.middleware before this controller runs)
         */


        /**
         * 3. Check account status
         */
        if (fromUserAccount.status !== "ACTIVE" || toUserAccount.status !== "ACTIVE") {
            return res.status(400).json({
                message: "Both fromAccount and toAccount must be ACTIVE to process transaction"
            })
        }

        /**
         * 4. Derive sender balance from ledger
         */
        const balance = await fromUserAccount.getBalance()

        if (balance < amount) {
            return res.status(400).json({
                message: `Insufficient balance. Current balance is ${balance}. Requested amount is ${amount}`
            })
        }

        /**
         * 5. Create transaction
         */
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
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                message: "Transaction is pending due to an issue, please retry after some time",
                error: error.message
            })
        }

        /**
         * 6. Send email notification
         */
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
            transaction: transaction
        };

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

        //will not happen unless human error but this is a fallback if the system account gets deleted somehow
        if (!fromUserAccount) {
            return res.status(400).json({
                message: "System user account not found"
            })
        }

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

            const responseObj = {
                message: "Initial funds transaction completed successfully",
                transaction: transaction
            };

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
