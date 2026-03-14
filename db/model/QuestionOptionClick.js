const mongoose = require("mongoose");

const QuestionOptionClickSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        question: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MCQ",
            required: true
        },
        selectedAnswer: {
            type: String,
            required: true
        },
        isCorrect: {
            type: Boolean,
            required: true
        }
    },
    { timestamps: true }
);

QuestionOptionClickSchema.index({ user: 1, question: 1, createdAt: -1 });

module.exports = mongoose.model("QuestionOptionClick", QuestionOptionClickSchema);
