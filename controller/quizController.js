const asyncErrorHandler = require("../middleware/asyncErrorHandler");
const quizService = require("../service/quizService");
const { successResponse } = require("../utility/successResponse");

const QuizController = {
    createQuiz: asyncErrorHandler(async (req, res) => {
        const response = await quizService.createQuiz(req.user.id, req.body);
        res.status(201).json(successResponse(201, response, "Quiz created successfully"));
    }),

    getQuizzes: asyncErrorHandler(async (req, res) => {
        const response = await quizService.getQuizzes(req.user.id);
        res.status(200).json(successResponse(200, response, "Quizzes fetched successfully"));
    }),

    getQuizById: asyncErrorHandler(async (req, res) => {
        // Pass showAnswers=true only in review mode (e.g. ?review=true)
        const showAnswers = req.query.review === 'true';
        const response = await quizService.getQuizById(req.user.id, req.params.quizId, showAnswers);
        res.status(200).json(successResponse(200, response, "Quiz fetched successfully"));
    }),

    updateQuiz: asyncErrorHandler(async (req, res) => {
        const response = await quizService.updateQuiz(req.user.id, req.params.quizId, req.body);
        res.status(202).json(successResponse(202, response, "Quiz updated successfully"));
    }),

    deleteQuiz: asyncErrorHandler(async (req, res) => {
        const response = await quizService.deleteQuiz(req.user.id, req.params.quizId);
        res.status(200).json(successResponse(200, response, "Quiz deleted successfully"));
    }),

    submitAttempt: asyncErrorHandler(async (req, res) => {
        const response = await quizService.submitAttempt(req.user.id, req.params.quizId, req.body);
        res.status(201).json(successResponse(201, response, "Attempt submitted successfully"));
    }),

    getAttempts: asyncErrorHandler(async (req, res) => {
        const response = await quizService.getAttempts(req.user.id, req.params.quizId);
        res.status(200).json(successResponse(200, response, "Attempts fetched successfully"));
    }),

    getAttemptById: asyncErrorHandler(async (req, res) => {
        const response = await quizService.getAttemptById(req.user.id, req.params.attemptId);
        res.status(200).json(successResponse(200, response, "Attempt fetched successfully"));
    }),
};

module.exports = { QuizController };
