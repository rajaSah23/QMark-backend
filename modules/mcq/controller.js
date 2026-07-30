"use strict"

const service = require("./service")
const { successResponse } = require("../../utils/response")

const getMCQs = async (req, res, next) => {
  const response = await service.getMCQs(req.user.id, req.query)
  res
    .status(200)
    .json(successResponse(200, response, "Questions sent successfully"))
}

const getMCQById = async (req, res, next) => {
  const response = await service.getMCQById(req.user.id, req.params)
  res
    .status(200)
    .json(successResponse(200, response, "Question sent successfully"))
}

const deleteMCQById = async (req, res, next) => {
  const response = await service.deleteMCQById(req.user.id, req.params)
  res
    .status(202)
    .json(successResponse(202, response, "Question deleted successfully"))
}

const postMCQ = async (req, res, next) => {
  const response = await service.postMCQs(req.user.id, req.body)
  res
    .status(201)
    .json(successResponse(201, response, "Question saved successfully"))
}

const updateMCQ = async (req, res, next) => {
  const response = await service.updateMCQ(req.user.id, req.body)
  res
    .status(202)
    .json(successResponse(202, response, "Question updated successfully"))
}

const bookmarkQuestion = async (req, res, next) => {
  const response = await service.bookmarkQuestion(req.user.id, req.body)
  res
    .status(202)
    .json(successResponse(202, response, "Question added to bookmarks"))
}

const trackOptionClick = async (req, res, next) => {
  const response = await service.trackOptionClick(
    req.user.id,
    req.params.questionId,
    req.body
  )
  res
    .status(201)
    .json(
      successResponse(201, response, "Question interaction tracked successfully")
    )
}

const getReviewQueue = async (req, res, next) => {
  const response = await service.getReviewQueue(req.user.id, req.query)
  res
    .status(200)
    .json(successResponse(200, response, "Review queue sent successfully"))
}

const getQuestionInteractionSummary = async (req, res, next) => {
  const response = await service.getQuestionInteractionSummary(
    req.user.id,
    req.query
  )
  res
    .status(200)
    .json(
      successResponse(
        200,
        response,
        "Question interaction analytics sent successfully"
      )
    )
}

const getQuestionInteractionDetail = async (req, res, next) => {
  const response = await service.getQuestionInteractionDetail(
    req.user.id,
    req.params.questionId,
    req.query
  )
  res
    .status(200)
    .json(
      successResponse(
        200,
        response,
        "Question interaction detail sent successfully"
      )
    )
}

const addQuestionComment = async (req, res, next) => {
  const response = await service.addQuestionComment(
    req.user.id,
    req.params.questionId,
    req.body
  )
  res
    .status(201)
    .json(successResponse(201, response, "Question comment added successfully"))
}

module.exports = {
  getMCQs,
  getMCQById,
  deleteMCQById,
  postMCQ,
  updateMCQ,
  bookmarkQuestion,
  trackOptionClick,
  getReviewQueue,
  getQuestionInteractionSummary,
  getQuestionInteractionDetail,
  addQuestionComment
}
