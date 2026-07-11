"use strict"

const mongoose = require("mongoose")
const MCQ = require("../mcq/model")
const repository = require("./repository")
const CustomError = require("../../utils/CustomError")
const {
  createQuizSchema,
  updateQuizSchema,
  submitAttemptSchema
} = require("./joiSchema")

// ─── Internal Helper ──────────────────────────────────────────────────────────

const buildAttemptSummary = (answers = []) => {
  return answers.reduce(
    (acc, answer) => {
      if (answer.status === "marked_for_review") acc.markedForReview += 1
      else if (answer.status === "answered") acc.answered += 1
      else acc.notAnswered += 1
      return acc
    },
    { answered: 0, notAnswered: 0, markedForReview: 0 }
  )
}

// ─── Service Methods ──────────────────────────────────────────────────────────

/**
 * Create a custom quiz.
 * Supply questionIds directly, OR supply filters to auto-pick questions.
 */
const createQuiz = async (userId, body) => {
  const { error, value } = createQuizSchema.validate(body)
  if (error) throw new CustomError(400, error.details[0].message)

  let questionIds = value.questionIds || []

  if (questionIds.length === 0 && value.filters) {
    const matchStage = { user: new mongoose.Types.ObjectId(userId) }
    const { subject, topic, difficulty, tags, limit } = value.filters

    if (subject) {
      try {
        matchStage.subject = new mongoose.Types.ObjectId(subject)
      } catch (_) {}
    }
    if (topic) {
      try {
        matchStage.topic = new mongoose.Types.ObjectId(topic)
      } catch (_) {}
    }
    if (difficulty) matchStage.difficulty = difficulty
    if (tags && tags.length > 0) matchStage.tag = { $in: tags }

    const questions = await MCQ.aggregate([
      { $match: matchStage },
      { $sample: { size: limit || 10 } },
      { $project: { _id: 1 } }
    ])
    questionIds = questions.map((q) => q._id)
  }

  if (questionIds.length === 0) {
    throw new CustomError(
      400,
      "No questions found for the given filters. Please add questions to your library first."
    )
  }

  const quizData = {
    user: userId,
    title: value.title,
    description: value.description,
    subject: value.subject || null,
    questions: questionIds,
    settings: value.settings
  }

  return await repository.createQuiz(quizData)
}

/**
 * List all quizzes for the user.
 */
const getQuizzes = async (userId, query = {}) => {
  if (!userId) throw new CustomError(400, "User ID is required")

  const filter = {}

  if (query?.subject && query.subject !== "all") {
    if (query.subject === "unassigned") {
      filter.subject = null
    } else {
      try {
        filter.subject = new mongoose.Types.ObjectId(query.subject)
      } catch (_) {
        throw new CustomError(400, "Invalid subject filter")
      }
    }
  }

  if (query?.active === "true") filter.active = true
  else if (query?.active === "false") filter.active = false

  return await repository.getQuizzesByUser(userId, filter)
}

/**
 * Get a single quiz. Correct answers hidden unless review mode.
 */
const getQuizById = async (userId, quizId, showAnswers = false) => {
  if (!quizId) throw new CustomError(400, "Quiz ID is required")

  const quiz = await repository.getQuizById(quizId)
  if (!quiz) throw new CustomError(404, "Quiz not found")
  if (quiz.user.toString() !== userId) throw new CustomError(403, "Access denied")
  if (quiz.deleted) throw new CustomError(404, "Quiz not found")

  if (!showAnswers) {
    const sanitized = quiz.toObject()
    sanitized.questions = sanitized.questions.map((q) => {
      const { correctAnswer, ...rest } = q
      return rest
    })
    return sanitized
  }

  return quiz
}

/**
 * Update quiz fields.
 */
const updateQuiz = async (userId, quizId, body) => {
  const { error, value } = updateQuizSchema.validate(body)
  if (error) throw new CustomError(400, error.details[0].message)

  const quiz = await repository.getQuizById(quizId)
  if (!quiz) throw new CustomError(404, "Quiz not found")
  if (quiz.user.toString() !== userId) throw new CustomError(403, "Access denied")
  if (quiz.deleted) throw new CustomError(404, "Quiz not found")

  const updateData = {}
  if (value.title) updateData.title = value.title
  if (value.description !== undefined) updateData.description = value.description
  if (Object.prototype.hasOwnProperty.call(value, "subject")) {
    updateData.subject = value.subject || null
  }
  if (value.questionIds) updateData.questions = value.questionIds
  if (value.active !== undefined) updateData.active = value.active
  if (value.settings)
    updateData.settings = { ...quiz.settings.toObject(), ...value.settings }

  return await repository.updateQuiz(quizId, updateData)
}

/**
 * Soft-delete a quiz.
 */
const deleteQuiz = async (userId, quizId) => {
  if (!quizId) throw new CustomError(400, "Quiz ID is required")

  const quiz = await repository.getQuizById(quizId)
  if (!quiz) throw new CustomError(404, "Quiz not found")
  if (quiz.user.toString() !== userId) throw new CustomError(403, "Access denied")
  if (quiz.deleted) throw new CustomError(404, "Quiz not found")

  return await repository.deleteQuiz(quizId)
}

/**
 * Submit answers for a quiz attempt. Grades automatically.
 */
const submitAttempt = async (userId, quizId, body) => {
  const { error, value } = submitAttemptSchema.validate(body)
  if (error) throw new CustomError(400, error.details[0].message)

  const quiz = await repository.getQuizById(quizId)
  if (!quiz) throw new CustomError(404, "Quiz not found")
  if (quiz.user.toString() !== userId) throw new CustomError(403, "Access denied")
  if (quiz.deleted) throw new CustomError(404, "Quiz not found")
  if (!quiz.active) throw new CustomError(404, "Quiz not found or deleted")

  const correctAnswerMap = {}
  quiz.questions.forEach((q) => {
    correctAnswerMap[q._id.toString()] = q.correctAnswer
  })

  const submittedAnswerMap = value.answers.reduce((acc, answer) => {
    acc[answer.question] = answer
    return acc
  }, {})

  let score = 0
  const gradedAnswers = quiz.questions.map((questionDoc) => {
    const questionId = questionDoc._id.toString()
    const submitted = submittedAnswerMap[questionId] || {}
    const selectedAnswer = submitted.selectedAnswer || null
    const markedForReview = !!submitted.markedForReview
    const visited = !!submitted.visited
    const correctAnswer = correctAnswerMap[questionId]

    if (selectedAnswer && !questionDoc.options.includes(selectedAnswer)) {
      throw new CustomError(
        400,
        "Invalid answer submitted for one or more questions"
      )
    }

    const status = markedForReview
      ? "marked_for_review"
      : selectedAnswer
      ? "answered"
      : "not_answered"
    const isCorrect =
      !!selectedAnswer && !!correctAnswer && selectedAnswer === correctAnswer
    if (isCorrect) score++

    return {
      question: questionId,
      selectedAnswer,
      status,
      markedForReview,
      visited,
      isCorrect
    }
  })

  const answerSummary = buildAttemptSummary(gradedAnswers)
  const attemptData = {
    user: userId,
    quiz: quizId,
    answers: gradedAnswers,
    score,
    totalQuestions: quiz.questions.length,
    timeTaken: value.timeTaken
  }

  const attempt = await repository.createAttempt(attemptData)

  // Log activity
  const activityService = require("../performance/service")
  await activityService.logActivity(userId, "QUIZ_ATTEMPT", 1)

  return {
    _id: attempt._id,
    attemptId: attempt._id,
    score,
    totalQuestions: quiz.questions.length,
    percentage:
      quiz.questions.length > 0
        ? Math.round((score / quiz.questions.length) * 100)
        : 0,
    timeTaken: value.timeTaken,
    answers: gradedAnswers,
    quiz: { _id: quiz._id, title: quiz.title },
    answerSummary
  }
}

/**
 * Get all attempts for a quiz.
 */
const getAttempts = async (userId, quizId) => {
  if (!quizId) throw new CustomError(400, "Quiz ID is required")

  const quiz = await repository.getQuizById(quizId)
  if (!quiz) throw new CustomError(404, "Quiz not found")
  if (quiz.user.toString() !== userId) throw new CustomError(403, "Access denied")
  if (quiz.deleted) throw new CustomError(404, "Quiz not found")

  const attempts = await repository.getAttemptsByQuiz(userId, quizId)
  return attempts.map((attempt) => ({
    ...attempt.toObject(),
    percentage:
      attempt.totalQuestions > 0
        ? Math.round((attempt.score / attempt.totalQuestions) * 100)
        : 0,
    answerSummary: buildAttemptSummary(attempt.answers || [])
  }))
}

/**
 * Get a single attempt with detailed breakdown.
 */
const getAttemptById = async (userId, attemptId) => {
  if (!attemptId) throw new CustomError(400, "Attempt ID is required")

  const attempt = await repository.getAttemptById(attemptId)
  if (!attempt) throw new CustomError(404, "Attempt not found")
  if (attempt.user.toString() !== userId)
    throw new CustomError(403, "Access denied")
  if (attempt.quiz?.deleted) throw new CustomError(404, "Quiz not found")

  const attemptObj = attempt.toObject()
  return {
    ...attemptObj,
    percentage:
      attempt.totalQuestions > 0
        ? Math.round((attempt.score / attempt.totalQuestions) * 100)
        : 0,
    answerSummary: buildAttemptSummary(attempt.answers || [])
  }
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
