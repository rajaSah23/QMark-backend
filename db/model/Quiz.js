const mongoose = require('mongoose');

const QuizSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            default: ''
        },
        subject: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'subject',
            default: null
        },
        questions: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'MCQ'
            }
        ],
        settings: {
            shuffleQuestions: {
                type: Boolean,
                default: false
            },
            shuffleOptions: {
                type: Boolean,
                default: false
            },
            timeLimit: {
                type: Number,
                default: 0, // 0 = no limit (in minutes)
                min: 0
            }
        },
        active: {
            type: Boolean,
            default: true
        },
        deleted: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

const Quiz = mongoose.model('Quiz', QuizSchema);
module.exports = Quiz;
