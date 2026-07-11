"use strict"

const MCQ = require("./model")
const CustomError = require("../../utils/CustomError")

// ─── Aggregation ──────────────────────────────────────────────────────────────

const aggregateMCQs = (pipeline) => MCQ.aggregate(pipeline)

// ─── Query ────────────────────────────────────────────────────────────────────

const getMCQById = async (questionId) => {
  const response = await MCQ.findById(questionId)
  if (!response) throw new CustomError(404, "Question not found")
  return response
}

const getQuestion = (condition) => MCQ.findOne(condition)

// ─── Create ───────────────────────────────────────────────────────────────────

const postMCQs = async (data) => {
  const mcq = await MCQ.create(data)
  return await MCQ.findById(mcq._id).populate("subject").populate("topic")
}

// ─── Update ───────────────────────────────────────────────────────────────────

const updateMCQ = async (questionId, data) => {
  const response = await MCQ.findByIdAndUpdate(questionId, data, { new: true })
    .populate("subject")
    .populate("topic")
  if (!response) throw new CustomError(404, "Question not found")
  return response
}

// ─── Delete ───────────────────────────────────────────────────────────────────

const deleteMCQById = async (questionId) => {
  const response = await MCQ.findByIdAndDelete(questionId)
  if (!response) throw new CustomError(404, "Question not found")
  return response
}

module.exports = {
  aggregateMCQs,
  getMCQById,
  getQuestion,
  postMCQs,
  updateMCQ,
  deleteMCQById
}
