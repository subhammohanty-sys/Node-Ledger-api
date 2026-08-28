const IdempotencyKey = require('../models/idempotencyKey.model');

const verifyIdempotencyKey = async (req, res, next) => {
    try {
        const key = req.headers['idempotency-key'];

        if (!key) {
            return res.status(400).json({ success: false, message: 'Idempotency-Key header is required' });
        }

        const idempotencyRecord = await IdempotencyKey.findOne({ key });

        if (!idempotencyRecord) {
            return res.status(400).json({
                success: false, message: 'Invalid or expired idempotency key'
            });
        }

        if (idempotencyRecord.status === 'completed') {
            return res.status(200).json(idempotencyRecord.responseBody);
        }

        if (idempotencyRecord.status === 'in_progress') {
            // A request is currently being processed with this key
            return res.status(409).json({
                success: false, message: 'Request with this key is already in progress'
            });
        }

        if (idempotencyRecord.status === 'pending') {
            // Mark as in progress and let the request continue
            idempotencyRecord.status = 'in_progress';
            await idempotencyRecord.save();

            // Pass the key down to the controller so it can update the status to 'completed' when finished
            req.idempotencyKey = key;
            next();
        }

    } catch (error) {
        console.error('Idempotency middleware error:', error);
        return res.status(500).json({
            success: false, message: 'Internal server error'
        });
    }
};

module.exports = {
    verifyIdempotencyKey
};
