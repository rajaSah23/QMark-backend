"use strict"

const service = require("./service")
const { successResponse } = require("../../utils/response")
const { dateRangeSchema } = require("./joiSchema")
const { errorResponse } = require("../../utils/response")

const getDailyActivityStats = async (req, res, next) => {
  const { error } = dateRangeSchema.validate(req.query)
  if (error) {
    return res.status(400).json({
      statusCode: 400,
      message: error.details[0].message
    })
  }
  const { startDate, endDate } = req.query
  const response = await service.getDailyActivityStats(
    req.user.id,
    startDate,
    endDate
  )
  res
    .status(200)
    .json(
      successResponse(200, response, "Daily activity stats fetched successfully")
    )
}

const getStreakRecord = async (req, res, next) => {
  const response = await service.getStreakRecord(req.user.id)
  res
    .status(200)
    .json(successResponse(200, response, "Streak record fetched successfully"))
}

const getQuizPerformanceStats = async (req, res, next) => {
  const { error } = dateRangeSchema.validate(req.query)
  if (error) {
    return res.status(400).json({
      statusCode: 400,
      message: error.details[0].message
    })
  }
  const { startDate, endDate } = req.query
  const response = await service.getQuizPerformanceStats(
    req.user.id,
    startDate,
    endDate
  )
  res
    .status(200)
    .json(
      successResponse(
        200,
        response,
        "Quiz performance stats fetched successfully"
      )
    )
}

const getSubjectWisePerformance = async (req, res, next) => {
  const { error } = dateRangeSchema.validate(req.query)
  if (error) {
    return res.status(400).json({
      statusCode: 400,
      message: error.details[0].message
    })
  }
  const { startDate, endDate } = req.query
  const response = await service.getSubjectWisePerformance(
    req.user.id,
    startDate,
    endDate
  )
  res
    .status(200)
    .json(
      successResponse(
        200,
        response,
        "Subject-wise performance fetched successfully"
      )
    )
}

const getDifficultyWisePerformance = async (req, res, next) => {
  const { error } = dateRangeSchema.validate(req.query)
  if (error) {
    return res.status(400).json({
      statusCode: 400,
      message: error.details[0].message
    })
  }
  const { startDate, endDate } = req.query
  const response = await service.getDifficultyWisePerformance(
    req.user.id,
    startDate,
    endDate
  )
  res
    .status(200)
    .json(
      successResponse(
        200,
        response,
        "Difficulty-wise performance fetched successfully"
      )
    )
}

const getPerformanceSummary = async (req, res, next) => {
  const response = await service.getPerformanceSummary(req.user.id)
  res
    .status(200)
    .json(
      successResponse(200, response, "Performance summary fetched successfully")
    )
}

module.exports = {
  getDailyActivityStats,
  getStreakRecord,
  getQuizPerformanceStats,
  getSubjectWisePerformance,
  getDifficultyWisePerformance,
  getPerformanceSummary
}
