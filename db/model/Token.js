const mongoose = require('mongoose');

const TokenSchema = mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        token: {
            type: String,
        },
        validity: {
            type: Date,
            default: Date.now() + 10 * 60 * 1000// 10 minutes
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('token', TokenSchema);