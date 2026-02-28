/**
 * PERFORMANCE DASHBOARD API DOCUMENTATION
 * 
 * All endpoints require JWT authentication via the verifyJWT middleware
 * Base URL: /api/performance
 * 
 * ENDPOINTS:
 * 
 * 1. GET /api/performance/daily-activity
 *    Query Parameters:
 *      - startDate (required): ISO date string (YYYY-MM-DD)
 *      - endDate (required): ISO date string (YYYY-MM-DD)
 *    
 *    Response Example:
 *    {
 *      "status": true,
 *      "statusCode": 200,
 *      "data": [
 *        {
 *          "date": "2026-02-28",
 *          "questionsAdded": 5,
 *          "practiceSessions": 3,
 *          "revisionsSessions": 2,
 *          "totalActivity": 10
 *        }
 *      ],
 *      "message": "Daily activity stats fetched successfully"
 *    }
 * 
 * 2. GET /api/performance/streak
 *    Query Parameters: None
 *    
 *    Response Example:
 *    {
 *      "status": true,
 *      "statusCode": 200,
 *      "data": {
 *        "currentStreak": 5,
 *        "longestStreak": 15,
 *        "lastActivityDate": "2026-02-28T00:00:00.000Z"
 *      },
 *      "message": "Streak record fetched successfully"
 *    }
 * 
 * 3. GET /api/performance/quiz-stats
 *    Query Parameters:
 *      - startDate (required): ISO date string (YYYY-MM-DD)
 *      - endDate (required): ISO date string (YYYY-MM-DD)
 *    
 *    Response Example:
 *    {
 *      "status": true,
 *      "statusCode": 200,
 *      "data": [
 *        {
 *          "quizTitle": "Biology Quiz 1",
 *          "score": 8,
 *          "totalQuestions": 10,
 *          "percentage": 80,
 *          "timeTaken": 600,
 *          "date": "2026-02-28"
 *        }
 *      ],
 *      "message": "Quiz performance stats fetched successfully"
 *    }
 * 
 * 4. GET /api/performance/subject-wise
 *    Query Parameters:
 *      - startDate (required): ISO date string (YYYY-MM-DD)
 *      - endDate (required): ISO date string (YYYY-MM-DD)
 * 
 * 5. GET /api/performance/difficulty-wise
 *    Query Parameters:
 *      - startDate (required): ISO date string (YYYY-MM-DD)
 *      - endDate (required): ISO date string (YYYY-MM-DD)
 * 
 * 6. GET /api/performance/summary
 *    Query Parameters: None
 */

const asyncErrorHandler = require("../middleware/asyncErrorHandler");
const performanceService = require("../service/performanceService");
const { successResponse } = require("../utility/successResponse");

const PerformanceController = {
    getDailyActivityStats: asyncErrorHandler(async (req, res) => {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                status: false,
                message: "startDate and endDate are required"
            });
        }

        const response = await performanceService.getDailyActivityStats(
            req.user.id,
            startDate,
            endDate
        );
        res.status(200).json(
            successResponse(200, response, "Daily activity stats fetched successfully")
        );
    }),

    getStreakRecord: asyncErrorHandler(async (req, res) => {
        const response = await performanceService.getStreakRecord(req.user.id);
        res.status(200).json(
            successResponse(200, response, "Streak record fetched successfully")
        );
    }),

    getQuizPerformanceStats: asyncErrorHandler(async (req, res) => {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                status: false,
                message: "startDate and endDate are required"
            });
        }

        const response = await performanceService.getQuizPerformanceStats(
            req.user.id,
            startDate,
            endDate
        );
        res.status(200).json(
            successResponse(200, response, "Quiz performance stats fetched successfully")
        );
    }),

    getSubjectWisePerformance: asyncErrorHandler(async (req, res) => {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                status: false,
                message: "startDate and endDate are required"
            });
        }

        const response = await performanceService.getSubjectWisePerformance(
            req.user.id,
            startDate,
            endDate
        );
        res.status(200).json(
            successResponse(200, response, "Subject-wise performance fetched successfully")
        );
    }),

    getDifficultyWisePerformance: asyncErrorHandler(async (req, res) => {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                status: false,
                message: "startDate and endDate are required"
            });
        }

        const response = await performanceService.getDifficultyWisePerformance(
            req.user.id,
            startDate,
            endDate
        );
        res.status(200).json(
            successResponse(200, response, "Difficulty-wise performance fetched successfully")
        );
    }),

    getPerformanceSummary: asyncErrorHandler(async (req, res) => {
        const response = await performanceService.getPerformanceSummary(req.user.id);
        res.status(200).json(
            successResponse(200, response, "Performance summary fetched successfully")
        );
    })
};

module.exports = { PerformanceController };
