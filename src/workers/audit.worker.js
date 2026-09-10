const { Worker, Queue } = require('bullmq');
const redisClient = require('../config/redis');
const ledgerModel = require('../models/ledger.model');

const auditQueue = new Queue('audit-queue', { connection: redisClient });

async function scheduleDailyAudit() {
    await auditQueue.add('daily-audit', {}, {
        repeat: {
            pattern: '0 0 * * *'
        }
    });
    console.log("Schedule Daily Audit job");
}

const auditWorker = new Worker('audit-queue', async (job) => {
    console.log(" Starting Global Ledger Audit...");

    const results = await ledgerModel.aggregate([
        {
            $group: {
                _id: null,
                totalCredits: {
                    $sum: {
                        $cond: [
                            { $eq: ["$type", "CREDIT"] },
                            "$amount",
                            0
                        ]
                    }
                },
                totalDebits: {
                    $sum: {
                        $cond: [
                            { $eq: ["$type", "DEBIT"] },
                            "$amount",
                            0
                        ]
                    }
                }
            }
        }
    ]);

    if (results.length === 0) {
        console.log("Ledger is completely empty. Audit passed.");
        return;
    }

    const { totalCredits, totalDebits } = results[0];

    // WORST CASE SCENARIO
    // If credits and debits are not equal, trigger an alert and halt system
    if (totalCredits !== totalDebits) {
        console.error(`Ledger integrity failure! Credits: ${totalCredits} !== Debits: ${totalDebits}`);
    } else {
        console.log(`Ledger integrity verified. Total Credits (${totalCredits}) perfectly matches Total Debits (${totalDebits}).`);
    }

}, { connection: redisClient });

auditWorker.on('failed', (job, err) => {
    console.error(`[Audit Worker] Job ${job.id} failed:`, err);
});

module.exports = {
    auditWorker,
    scheduleDailyAudit
};
