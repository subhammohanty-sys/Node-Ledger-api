const mongoose = require('mongoose');

const idempotencyKeySchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed'],
        default: 'pending'
    },
    responseBody: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 86400
    }
});

const IdempotencyKey = mongoose.model('IdempotencyKey', idempotencyKeySchema);
module.exports = IdempotencyKey;
