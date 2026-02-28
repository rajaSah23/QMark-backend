const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        date: {
            type: Date,
            default: () => new Date(new Date().setHours(0, 0, 0, 0))
        },
        questionsAdded: {
            type: Number,
            default: 0
        },
        practiceAttempts: {
            type: Number,
            default: 0
        },
        practiceSessions: {
            type: Number,
            default: 0
        },
        revisionsAttempts: {
            type: Number,
            default: 0
        },
        revisionsSessions: {
            type: Number,
            default: 0
        },
        totalActivity: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

// Index for efficient querying by user and date
ActivitySchema.index({ user: 1, date: -1 });

const Activity = mongoose.model('Activity', ActivitySchema);
module.exports = Activity;
