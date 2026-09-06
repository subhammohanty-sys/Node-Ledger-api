const { Queue } = require('bullmq');

const connection = {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
};

const emailQueue = new Queue('email-queue', { connection });

module.exports = emailQueue;
