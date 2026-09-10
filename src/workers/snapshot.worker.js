const { Worker } = require('bullmq');
const redisClient = require('../config/redis');
const ledgerModel = require('../models/ledger.model');
const snapshotModel = require('../models/snapshot.model');
const accountModel = require('../models/account.model');

const connection = redisClient;

const snapshotWorker = new Worker('snapshot-queue', async (job) => {
    const { accountId } = job.data;

    const latestSnapshot = await snapshotModel.findOne({ account: accountId }).sort({ createdAt: -1 });

    const matchQuery = { account: accountId };
    if (latestSnapshot) {
        matchQuery._id = { $gt: latestSnapshot.lastLedgerId };
    }

    const newEntryCount = await ledgerModel.countDocuments(matchQuery);

    if (newEntryCount >= 100) {
        console.log(`Triggering rollup for account ${accountId}. ${newEntryCount} new entries found.`);

        const account = await accountModel.findById(accountId);
        if (!account) return;

        const freshBalance = await account.getBalance();

        const newestLedgerEntry = await ledgerModel.findOne({ account: accountId }).sort({ _id: -1 });

        if (newestLedgerEntry) {
            await snapshotModel.create({
                account: accountId,
                balance: freshBalance,
                lastLedgerId: newestLedgerEntry._id
            });
            console.log(`Snapshot successfully created for account ${accountId}.`);
        }
    }

}, { connection });

snapshotWorker.on('failed', (job, err) => {
    console.log(`Job ${job.id} failed: ${err.message}`);
});

module.exports = snapshotWorker;
