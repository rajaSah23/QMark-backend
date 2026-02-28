const express = require('express');
const { QuizController } = require('../controller/quizController');
const { userAuth } = require('../middleware/userAuthMiddleware');
const router = express.Router();

// Quiz CRUD
router.post("/", userAuth, QuizController.createQuiz);
router.get("/", userAuth, QuizController.getQuizzes);
router.get("/:quizId", userAuth, QuizController.getQuizById);
router.put("/:quizId", userAuth, QuizController.updateQuiz);
router.delete("/:quizId", userAuth, QuizController.deleteQuiz);

// Attempts
router.post("/:quizId/attempt", userAuth, QuizController.submitAttempt);
router.get("/:quizId/attempts", userAuth, QuizController.getAttempts);
router.get("/:quizId/attempts/:attemptId", userAuth, QuizController.getAttemptById);

module.exports = router;
