const crypto = require('crypto');
const IdempotencyKey = require('../models/idempotencyKey.model');

const generateIdempotencyKey = async (req, res) => {
    try {
        if (!req.user?._id) {
            return res.status(401).json({
                success: false, message: 'Unauthorized access'
            });
        }

        const key = crypto.randomUUID();

        // Save the pending key bound to the authenticated user
        await IdempotencyKey.create({
            key,
            user: req.user._id,
            status: 'pending'
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
