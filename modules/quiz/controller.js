"use strict"

const service = require("./service")
const { successResponse } = require("../../utils/response")

const createQuiz = async (req, res, next) => {
  const response = await service.createQuiz(req.user.id, req.body)
  res.status(201).json(successResponse(201, response, "Quiz created successfully"))
}

const getQuizzes = async (req, res, next) => {
  const response = await service.getQuizzes(req.user.id, req.query)
  res
    .status(200)
    .json(successResponse(200, response, "Quizzes fetched successfully"))
}

const getQuizById = async (req, res, next) => {
  const showAnswers = req.query.review === "true"
  const response = await service.getQuizById(
    req.user.id,
    req.params.quizId,
    showAnswers
  )
  res.status(200).json(successResponse(200, response, "Quiz fetched successfully"))
}

const updateQuiz = async (req, res, next) => {
  const response = await service.updateQuiz(
    req.user.id,
    req.params.quizId,
    req.body
  )
  res
    .status(202)
    .json(successResponse(202, response, "Quiz updated successfully"))
}

const deleteQuiz = async (req, res, next) => {
  const response = await service.deleteQuiz(req.user.id, req.params.quizId)
  res
    .status(200)
    .json(successResponse(200, response, "Quiz deleted successfully"))
}

const submitAttempt = async (req, res, next) => {
  const response = await service.submitAttempt(
    req.user.id,
    req.params.quizId,
    req.body
  )
  res
    .status(201)
    .json(successResponse(201, response, "Attempt submitted successfully"))
}

const getAttempts = async (req, res, next) => {
  const response = await service.getAttempts(req.user.id, req.params.quizId)
  res
    .status(200)
    .json(successResponse(200, response, "Attempts fetched successfully"))
}

const getAttemptById = async (req, res, next) => {
  const response = await service.getAttemptById(
    req.user.id,
    req.params.attemptId
  )
  res
    .status(200)
    .json(successResponse(200, response, "Attempt fetched successfully"))
}

module.exports = {
  createQuiz,
  getQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  submitAttempt,
  getAttempts,
  getAttemptById
}
