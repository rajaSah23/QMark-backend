const Quiz = require("../db/model/Quiz");
const QuizAttempt = require("../db/model/QuizAttempt");

const quizRepository = {
    // --- Quiz CRUD ---

    createQuiz: async (data) => {
        const quiz = await Quiz.create(data);
        return await Quiz.findById(quiz._id).populate("subject", "subject");
    },

    getQuizById: async (quizId) => {
        return await Quiz.findById(quizId)
            .populate("subject", "subject")
            .populate({
                path: "questions",
                populate: [
                    { path: "subject", select: "subject" },
                    { path: "topic", select: "topic" }
                ]
            });
    },

    getQuizzesByUser: async (userId, filter = {}) => {
        return await Quiz.find({ user: userId, deleted: { $ne: true }, ...filter })
            .populate("subject", "subject")
            .sort({ createdAt: -1 });
    },

    updateQuiz: async (quizId, data) => {
        return await Quiz.findByIdAndUpdate(quizId, data, { new: true })
            .populate("subject", "subject");
    },

    deleteQuiz: async (quizId) => {
        return await Quiz.findByIdAndUpdate(quizId, { deleted: true }, { new: true });
    },

    // --- Attempt CRUD ---

    createAttempt: async (data) => {
        return await QuizAttempt.create(data);
    },

    getAttemptsByQuiz: async (userId, quizId) => {
        return await QuizAttempt.find({ user: userId, quiz: quizId }).sort({ createdAt: -1 });
    },

    getAttemptById: async (attemptId) => {
        return await QuizAttempt.findById(attemptId)
            .populate("quiz", "title description settings")
            .populate({
                path: "answers.question",
                select: "question options correctAnswer explanation difficulty subject topic",
                populate: [
                    { path: "subject", select: "subject" },
                    { path: "topic", select: "topic" }
                ]
            });
    },
};

module.exports = quizRepository;
