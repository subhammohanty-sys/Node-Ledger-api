const mongoose = require("mongoose");


const tokenBlacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required: [true, "Token is required"],
        unique: [true, "Token is already blacklisted"]
    }
}, {

    timestamps: true
})

tokenBlacklistSchema.index({ createdAt: 1 }, {
    expireAfterSeconds: 60 * 60 * 24 * 7 //delete token after 7 days
});


const TokenBlackListModel = mongoose.model("TokenBlacklist", tokenBlacklistSchema);
module.exports = TokenBlackListModel