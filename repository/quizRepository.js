const Quiz = require("../db/model/Quiz");
const QuizAttempt = require("../db/model/QuizAttempt");

const quizRepository = {
    // --- Quiz CRUD ---

    createQuiz: async (data) => {
        return await Quiz.create(data);
    },

    getQuizById: async (quizId) => {
        return await Quiz.findById(quizId).populate({
            path: "questions",
            populate: [
                { path: "subject", select: "subject" },
                { path: "topic", select: "topic" }
            ]
        });
    },

    getQuizzesByUser: async (userId) => {
        return await Quiz.find({ user: userId, active: true }).sort({ createdAt: -1 });
    },

    updateQuiz: async (quizId, data) => {
        return await Quiz.findByIdAndUpdate(quizId, data, { new: true });
    },

    deleteQuiz: async (quizId) => {
        return await Quiz.findByIdAndUpdate(quizId, { active: false }, { new: true });
    },

    // --- Attempt CRUD ---

    createAttempt: async (data) => {
        return await QuizAttempt.create(data);
    },

    getAttemptsByQuiz: async (userId, quizId) => {
        return await QuizAttempt.find({ user: userId, quiz: quizId }).sort({ createdAt: -1 });
    },

    getAttemptById: async (attemptId) => {
        return await QuizAttempt.findById(attemptId).populate({
            path: "answers.question",
            select: "question options correctAnswer explanation difficulty"
        });
    },
};

module.exports = quizRepository;
