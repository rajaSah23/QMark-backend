"use strict"

const express = require("express")
const router = express.Router()
const controller = require("./controller")
const asyncHandler = require("../../middlewares/asyncHandler")
const { userAuth } = require("../../middlewares/auth")

// All quiz routes require authentication
router.use(userAuth)

// Quiz CRUD
router.post("/", asyncHandler(controller.createQuiz))
router.get("/", asyncHandler(controller.getQuizzes))
router.get("/:quizId", asyncHandler(controller.getQuizById))
router.put("/:quizId", asyncHandler(controller.updateQuiz))
router.delete("/:quizId", asyncHandler(controller.deleteQuiz))

// Attempts
router.post("/:quizId/attempt", asyncHandler(controller.submitAttempt))
router.get("/:quizId/attempts", asyncHandler(controller.getAttempts))
router.get("/:quizId/attempts/:attemptId", asyncHandler(controller.getAttemptById))

// Community quizzes: publishing and the leaderboard it gates
router.post("/:quizId/publish", asyncHandler(controller.publishResults))
router.get("/:quizId/leaderboard", asyncHandler(controller.getLeaderboard))

module.exports = router
