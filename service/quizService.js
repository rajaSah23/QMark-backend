const { default: mongoose } = require("mongoose");
const MCQ = require("../db/model/MCQModel");
const quizRepository = require("../repository/quizRepository");
const CustomError = require("../utility/CustomError");
const { createQuizSchema, updateQuizSchema, submitAttemptSchema } = require("../validation/quizValidation");
const activityService = require("./activityService");

const quizService = {
    /**
     * Create a custom quiz.
     * Supply questionIds directly, OR supply filters to auto-pick questions.
     */
    createQuiz: async (userId, body) => {
        const { error, value } = createQuizSchema.validate(body);
        if (error) throw new CustomError(400, error.details[0].message);

        let questionIds = value.questionIds || [];

        // Auto-pick questions using filters if no explicit IDs given
        if (questionIds.length === 0 && value.filters) {
            const matchStage = { user: new mongoose.Types.ObjectId(userId) };
            const { subject, topic, difficulty, tags, limit } = value.filters;

            if (subject) {
                try { matchStage.subject = new mongoose.Types.ObjectId(subject); } catch (_) { }
            }
            if (topic) {
                try { matchStage.topic = new mongoose.Types.ObjectId(topic); } catch (_) { }
            }
            if (difficulty) matchStage.difficulty = difficulty;
            if (tags && tags.length > 0) matchStage.tag = { $in: tags };

            //select random questions based on the filters
            const questions = await MCQ.aggregate([
                { $match: matchStage },
                { $sample: { size: limit || 10 } },
                { $project: { _id: 1 } }
            ]);
            questionIds = questions.map((q) => q._id);
        }

        if (questionIds.length === 0) {
            throw new CustomError(400, "No questions found for the given filters. Please add questions to your library first.");
        }

        const quizData = {
            user: userId,
            title: value.title,
            description: value.description,
            questions: questionIds,
            settings: value.settings
        };

        const quiz = await quizRepository.createQuiz(quizData);
        return quiz;
    },

    /**
     * List all quizzes for the user.
     */
    getQuizzes: async (userId) => {
        if (!userId) throw new CustomError(400, "User ID is required");
        const quizzes = await quizRepository.getQuizzesByUser(userId);
        return quizzes;
    },

    /**
     * Get a single quiz with full question details.
     * Correct answers are hidden for active quiz-taking; pass showAnswers=true for review mode.
     */
    getQuizById: async (userId, quizId, showAnswers = false) => {
        if (!quizId) throw new CustomError(400, "Quiz ID is required");

        const quiz = await quizRepository.getQuizById(quizId);
        if (!quiz) throw new CustomError(404, "Quiz not found");
        if (quiz.user.toString() !== userId) throw new CustomError(403, "Access denied");
        if (!quiz.active) throw new CustomError(404, "Quiz not found or deleted");

        // Strip correct answers unless review mode
        if (!showAnswers) {
            const sanitized = quiz.toObject();
            sanitized.questions = sanitized.questions.map((q) => {
                const { correctAnswer, ...rest } = q;
                return rest;
            });
            return sanitized;
        }

        return quiz;
    },

    /**
     * Update quiz title, description, settings, or question list.
     */
    updateQuiz: async (userId, quizId, body) => {
        const { error, value } = updateQuizSchema.validate(body);
        if (error) throw new CustomError(400, error.details[0].message);

        const quiz = await quizRepository.getQuizById(quizId);
        if (!quiz) throw new CustomError(404, "Quiz not found");
        if (quiz.user.toString() !== userId) throw new CustomError(403, "Access denied");

        const updateData = {};
        if (value.title) updateData.title = value.title;
        if (value.description !== undefined) updateData.description = value.description;
        if (value.questionIds) updateData.questions = value.questionIds;
        if (value.settings) updateData.settings = { ...quiz.settings.toObject(), ...value.settings };

        const updated = await quizRepository.updateQuiz(quizId, updateData);
        return updated;
    },

    /**
     * Soft-delete a quiz.
     */
    deleteQuiz: async (userId, quizId) => {
        if (!quizId) throw new CustomError(400, "Quiz ID is required");

        const quiz = await quizRepository.getQuizById(quizId);
        if (!quiz) throw new CustomError(404, "Quiz not found");
        if (quiz.user.toString() !== userId) throw new CustomError(403, "Access denied");

        return await quizRepository.deleteQuiz(quizId);
    },

    /**
     * Submit answers for a quiz attempt. Grades automatically.
     */
    submitAttempt: async (userId, quizId, body) => {
        const { error, value } = submitAttemptSchema.validate(body);
        if (error) throw new CustomError(400, error.details[0].message);

        const quiz = await quizRepository.getQuizById(quizId);
        if (!quiz) throw new CustomError(404, "Quiz not found");
        if (quiz.user.toString() !== userId) throw new CustomError(403, "Access denied");
        if (!quiz.active) throw new CustomError(404, "Quiz not found or deleted");

        // Build a lookup of correct answers from the populated quiz
        const correctAnswerMap = {};
        quiz.questions.forEach((q) => {
            correctAnswerMap[q._id.toString()] = q.correctAnswer;
        });

        let score = 0;
        const gradedAnswers = value.answers.map((ans) => {
            const correctAnswer = correctAnswerMap[ans.question];
            const isCorrect = !!correctAnswer && ans.selectedAnswer === correctAnswer;
            if (isCorrect) score++;
            return {
                question: ans.question,
                selectedAnswer: ans.selectedAnswer || null,
                isCorrect
            };
        });

        const attemptData = {
            user: userId,
            quiz: quizId,
            answers: gradedAnswers,
            score,
            totalQuestions: quiz.questions.length,
            timeTaken: value.timeTaken
        };

        const attempt = await quizRepository.createAttempt(attemptData);

        // Log activity for quiz attempt
        await activityService.logActivity(userId, 'QUIZ_ATTEMPT', 1);

        return {
            attemptId: attempt._id,
            score,
            totalQuestions: quiz.questions.length,
            percentage: quiz.questions.length > 0 ? Math.round((score / quiz.questions.length) * 100) : 0,
            timeTaken: value.timeTaken,
            answers: gradedAnswers
        };
    },

    /**
     * Get all attempts for a quiz.
     */
    getAttempts: async (userId, quizId) => {
        if (!quizId) throw new CustomError(400, "Quiz ID is required");

        const quiz = await quizRepository.getQuizById(quizId);
        if (!quiz) throw new CustomError(404, "Quiz not found");
        if (quiz.user.toString() !== userId) throw new CustomError(403, "Access denied");

        return await quizRepository.getAttemptsByQuiz(userId, quizId);
    },

    /**
     * Get a single attempt with detailed per-question breakdown.
     */
    getAttemptById: async (userId, attemptId) => {
        if (!attemptId) throw new CustomError(400, "Attempt ID is required");

        const attempt = await quizRepository.getAttemptById(attemptId);
        if (!attempt) throw new CustomError(404, "Attempt not found");
        if (attempt.user.toString() !== userId) throw new CustomError(403, "Access denied");

        return attempt;
    }
};

module.exports = quizService;
