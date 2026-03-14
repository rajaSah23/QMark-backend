const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema(
    {
        question: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MCQ',
            required: true
        },
        selectedAnswer: {
            type: String,
            default: null // null means skipped
        },
        status: {
            type: String,
            enum: ['not_answered', 'answered', 'marked_for_review'],
            default: 'not_answered'
        },
        markedForReview: {
            type: Boolean,
            default: false
        },
        visited: {
            type: Boolean,
            default: false
        },
        isCorrect: {
            type: Boolean,
            required: true
        }
    },
    { _id: false }
);

const QuizAttemptSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        quiz: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Quiz',
            required: true
        },
        answers: [AnswerSchema],
        score: {
            type: Number,
            required: true,
            min: 0
        },
        totalQuestions: {
            type: Number,
            required: true
        },
        timeTaken: {
            type: Number,
            default: 0 // in seconds
        }
    },
    { timestamps: true }
);

const QuizAttempt = mongoose.model('QuizAttempt', QuizAttemptSchema);
module.exports = QuizAttempt;
