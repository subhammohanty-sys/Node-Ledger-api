const { Worker } = require('bullmq');
const emailService = require('../services/email.service');

const connection = {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
};

const emailWorker = new Worker('email-queue', async (job) => {
    console.log(`Processing job ${job.id} of type ${job.name}...`);

    try {
        if (job.name === 'registration') {
            const { email, name } = job.data;

            await emailService.sendRegistrationEmail(email, name);

            console.log(`Registration email sent to ${email}`);

        } else if (job.name === 'transaction') {
            const { email, name, amount, toAccount } = job.data;

            await emailService.sendTransactionEmail(email, name, amount, toAccount);

            console.log(`Transaction email sent to ${email}`);

        }
    } catch (error) {
        console.error(`Failed to process job ${job.id}:`, error.message);
        throw error;
    }

}, {
    connection,
    settings: {
        backoffStrategies: {
            fixed: function (attemptsMade, err, options) {
                return 5000;
            }
        }
    }
});

emailWorker.on('failed', (job, err) => {
    console.log(`Job ${job.id} has failed with ${err.message}`);
});

module.exports = emailWorker;
