"use strict"

const express = require("express")
const router = express.Router()
const controller = require("./controller")
const asyncHandler = require("../../middlewares/asyncHandler")
const { userAuth } = require("../../middlewares/auth")

// All performance routes require authentication
router.use(userAuth)

router.get("/daily-activity", asyncHandler(controller.getDailyActivityStats))
router.get("/streak", asyncHandler(controller.getStreakRecord))
router.get("/quiz-stats", asyncHandler(controller.getQuizPerformanceStats))
router.get("/subject-wise", asyncHandler(controller.getSubjectWisePerformance))
router.get("/difficulty-wise", asyncHandler(controller.getDifficultyWisePerformance))
router.get("/summary", asyncHandler(controller.getPerformanceSummary))

module.exports = router
