const mongoose = require('mongoose');

const snapshotSchema = new mongoose.Schema({
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: [true, "Snapshot must be associated with an account"],
        index: true
    },
    balance: {
        type: Number,
        required: [true, "Balance is required"]
    },
    lastLedgerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ledger",
        required: [true, "Snapshot must reference the last included ledger entry"]
    }
}, {
    timestamps: true
});

snapshotSchema.index({ account: 1, createdAt: -1 });

const snapshotModel = mongoose.model('snapshot', snapshotSchema);

module.exports = snapshotModel;
