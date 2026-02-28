const express = require("express");
const router = express.Router();
const { PerformanceController } = require("../controller/performanceController");
const { userAuth } = require("../middleware/userAuthMiddleware");

// All routes require authentication
router.use(userAuth);

// Daily activity stats
router.get("/daily-activity", PerformanceController.getDailyActivityStats);

// Streak record
router.get("/streak", PerformanceController.getStreakRecord);

// Quiz performance stats
router.get("/quiz-stats", PerformanceController.getQuizPerformanceStats);

// Subject-wise performance
router.get("/subject-wise", PerformanceController.getSubjectWisePerformance);

// Difficulty-wise performance
router.get("/difficulty-wise", PerformanceController.getDifficultyWisePerformance);

// Overall performance summary
router.get("/summary", PerformanceController.getPerformanceSummary);

module.exports = router;
