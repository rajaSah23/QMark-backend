"use strict"

const Quiz = require("./model")
const QuizAttempt = require("./attemptModel")

// ─── Quiz CRUD ────────────────────────────────────────────────────────────────

const createQuiz = async (data) => {
  const quiz = await Quiz.create(data)
  return await Quiz.findById(quiz._id).populate("subject", "subject")
}

const getQuizById = (quizId) =>
  Quiz.findById(quizId)
    .populate("subject", "subject")
    .populate({
      path: "questions",
      populate: [
        { path: "subject", select: "subject" },
        { path: "topic", select: "topic" }
      ]
    })

const getQuizzesByUser = (userId, filter = {}) =>
  Quiz.find({ user: userId, deleted: { $ne: true }, ...filter })
    .populate("subject", "subject")
    .sort({ createdAt: -1 })

const updateQuiz = (quizId, data) =>
  Quiz.findByIdAndUpdate(quizId, data, { new: true }).populate(
    "subject",
    "subject"
  )

const deleteQuiz = (quizId) =>
  Quiz.findByIdAndUpdate(quizId, { deleted: true }, { new: true })

// ─── Attempt CRUD ─────────────────────────────────────────────────────────────

const createAttempt = (data) => QuizAttempt.create(data)

const getAttemptsByQuiz = (userId, quizId) =>
  QuizAttempt.find({ user: userId, quiz: quizId }).sort({ createdAt: -1 })

const getAttemptById = (attemptId) =>
  QuizAttempt.findById(attemptId)
    .populate("quiz", "title description settings")
    .populate({
      path: "answers.question",
      select:
        "question options correctAnswer explanation difficulty subject topic",
      populate: [
        { path: "subject", select: "subject" },
        { path: "topic", select: "topic" }
      ]
    })

module.exports = {
  createQuiz,
  getQuizById,
  getQuizzesByUser,
  updateQuiz,
  deleteQuiz,
  createAttempt,
  getAttemptsByQuiz,
  getAttemptById
}
