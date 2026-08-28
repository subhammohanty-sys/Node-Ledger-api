const crypto = require('crypto');
const IdempotencyKey = require('../models/idempotencyKey.model');

const generateIdempotencyKey = async (req, res) => {
    try {

        const key = crypto.randomUUID();

        // Save the pending key in the database
        await IdempotencyKey.create({
            key, status: 'pending'
        });

        return res.status(201).json({
            success: true,
            message: 'Idempotency key generated successfully',
            data: { idempotencyKey: key }
        });

    } catch (error) {
        console.error('Error generating idempotency key:', error);

        return res.status(500).json({
            success: false, message: 'Internal server error'
        });
    }
};

module.exports = {
    generateIdempotencyKey
};
