const { Queue } = require('bullmq');
const redisClient = require('../config/redis');

const connection = redisClient;

const snapshotQueue = new Queue('snapshot-queue', { connection });

module.exports = snapshotQueue;
