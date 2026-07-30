"use strict"

const mongoose = require("mongoose")
const MCQ = require("../mcq/model")
const QuestionOptionClick = require("../mcq/optionClickModel")
const CommunityQuestion = require("../community/questionModel")
const { getMemberRole, canModerate } = require("../community/access")
const { canAccessQuiz, canManageQuiz } = require("./access")
const { selectAdaptiveQuestions } = require("./adaptiveSelector")
const repository = require("./repository")
const CustomError = require("../../utils/CustomError")
const {
  createQuizSchema,
  updateQuizSchema,
  submitAttemptSchema
} = require("./joiSchema")

// ─── Internal Helper ──────────────────────────────────────────────────────────

/**
 * This user's answer accuracy per subject, keyed by subject id (string).
 * Subjects with zero clicks are simply absent from the result — the caller
 * (adaptiveSelector) treats a missing key as "no history", not as 0%.
 */
const computeSubjectAccuracy = async (userId, subjectIds = []) => {
  if (subjectIds.length === 0) return {}

  const rows = await QuestionOptionClick.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: "mcqs",
        localField: "question",
        foreignField: "_id",
        as: "mcq"
      }
    },
    { $unwind: "$mcq" },
    { $match: { "mcq.subject": { $in: subjectIds } } },
    {
      $group: {
        _id: "$mcq.subject",
        total: { $sum: 1 },
        correct: { $sum: { $cond: ["$isCorrect", 1, 0] } }
      }
    }
  ])

  const accuracyBySubject = {}
  for (const row of rows) {
    accuracyBySubject[row._id.toString()] = row.total > 0 ? row.correct / row.total : null
  }
  return accuracyBySubject
}

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
 *
 * If communityId is set, this becomes a community quiz: only a moderator or
 * admin of that community may create it, and its question pool is restricted
 * to questions APPROVED-shared in that community (never the creator's whole
 * personal bank) — every member must actually be able to see every question
 * on the quiz.
 */
const createQuiz = async (userId, body) => {
  const { error, value } = createQuizSchema.validate(body)
  if (error) throw new CustomError(400, error.details[0].message)

  const communityId = value.communityId || null
  let questionIds = value.questionIds || []

  if (communityId) {
    const role = await getMemberRole(userId, communityId)
    if (!canModerate(role))
      throw new CustomError(
        403,
        "Only moderators or admins can create a quiz in this community"
      )

    const approvedShares = await CommunityQuestion.find({
      community: communityId,
      status: "approved"
    })
      .select("question")
      .lean()
    const approvedQuestionIds = approvedShares.map((share) =>
      share.question.toString()
    )

    if (questionIds.length > 0) {
      const invalid = questionIds.filter(
        (id) => !approvedQuestionIds.includes(id.toString())
      )
      if (invalid.length > 0)
        throw new CustomError(
          400,
          "One or more questions are not shared and approved in this community"
        )
    } else if (value.filters && approvedQuestionIds.length > 0) {
      const matchStage = {
        _id: {
          $in: approvedQuestionIds.map((id) => new mongoose.Types.ObjectId(id))
        }
      }
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
  } else if (questionIds.length === 0 && value.filters) {
    const matchStage = { user: new mongoose.Types.ObjectId(userId) }
    const { subject, topic, difficulty, tags, limit, adaptive } = value.filters

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

    if (adaptive) {
      // Adaptive mode needs the full matching pool to weigh from, not a
      // pre-random sample of it. Capped at 500 as a pragmatic bound — the
      // selector itself shuffles within whatever it's given.
      const pool = await MCQ.aggregate([
        { $match: matchStage },
        { $limit: 500 },
        { $project: { _id: 1, subject: 1, difficulty: 1 } }
      ])

      const subjectIds = [...new Set(pool.filter((q) => q.subject).map((q) => q.subject))]
      const subjectAccuracy = await computeSubjectAccuracy(userId, subjectIds)

      questionIds = selectAdaptiveQuestions({
        pool,
        subjectAccuracy,
        limit: limit || 10,
        forcedDifficulty: difficulty || null
      })
    } else {
      const questions = await MCQ.aggregate([
        { $match: matchStage },
        { $sample: { size: limit || 10 } },
        { $project: { _id: 1 } }
      ])
      questionIds = questions.map((q) => q._id)
    }
  }

  if (questionIds.length === 0) {
    throw new CustomError(
      400,
      communityId
        ? "No shared, approved questions found in this community for the given filters."
        : "No questions found for the given filters. Please add questions to your library first."
    )
  }

  const quizData = {
    user: userId,
    title: value.title,
    description: value.description,
    subject: value.subject || null,
    community: communityId,
    questions: questionIds,
    settings: value.settings
  }

  return await repository.createQuiz(quizData)
}

/**
 * List quizzes. With communityId, lists that community's quizzes (member-gated)
 * instead of the caller's personal ones.
 */
const getQuizzes = async (userId, query = {}) => {
  if (!userId) throw new CustomError(400, "User ID is required")

  const filter = {}
  if (query?.active === "true") filter.active = true
  else if (query?.active === "false") filter.active = false

  if (query?.communityId) {
    const role = await getMemberRole(userId, query.communityId)
    if (!role) throw new CustomError(403, "Join this community to view its quizzes")
    return await repository.getQuizzesByCommunity(query.communityId, filter)
  }

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

  // Excludes this user's own community quizzes — those belong in that
  // community's list (communityId above), not the personal one.
  return await repository.getQuizzesByUser(userId, { ...filter, community: null })
}

/**
 * Get a single quiz. Correct answers hidden unless review mode.
 */
const getQuizById = async (userId, quizId, showAnswers = false) => {
  if (!quizId) throw new CustomError(400, "Quiz ID is required")

  const quiz = await repository.getQuizById(quizId)
  if (!quiz) throw new CustomError(404, "Quiz not found")
  if (quiz.deleted) throw new CustomError(404, "Quiz not found")
  if (!(await canAccessQuiz(userId, quiz)))
    throw new CustomError(403, "Access denied")

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
  if (quiz.deleted) throw new CustomError(404, "Quiz not found")
  if (!(await canManageQuiz(userId, quiz)))
    throw new CustomError(403, "Access denied")

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
  if (quiz.deleted) throw new CustomError(404, "Quiz not found")
  if (!(await canManageQuiz(userId, quiz)))
    throw new CustomError(403, "Access denied")

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
  if (quiz.deleted) throw new CustomError(404, "Quiz not found")
  if (!(await canAccessQuiz(userId, quiz)))
    throw new CustomError(403, "Access denied")
  if (!quiz.active) throw new CustomError(404, "Quiz not found or deleted")

  // Community quizzes are one-attempt, exam-style. Personal quizzes keep
  // allowing unlimited practice attempts, unchanged.
  if (quiz.community) {
    const existingAttempt = await repository.getAttemptByUserAndQuiz(userId, quizId)
    if (existingAttempt)
      throw new CustomError(400, "You have already attempted this quiz")
  }

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
  if (quiz.deleted) throw new CustomError(404, "Quiz not found")
  if (!(await canAccessQuiz(userId, quiz)))
    throw new CustomError(403, "Access denied")

  // Always scoped to the caller's own attempts, community quiz or not — this
  // is "my history", never a cross-user view (that's the leaderboard).
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
 * Publishes a community quiz's leaderboard. One-way: once published, results
 * stay visible (there is no unpublish — this mirrors the real "results day"
 * this feature is modelled on).
 */
const publishResults = async (userId, quizId) => {
  if (!quizId) throw new CustomError(400, "Quiz ID is required")

  const quiz = await repository.getQuizById(quizId)
  if (!quiz) throw new CustomError(404, "Quiz not found")
  if (quiz.deleted) throw new CustomError(404, "Quiz not found")
  if (!quiz.community)
    throw new CustomError(400, "Only community quizzes have publishable results")
  if (!(await canManageQuiz(userId, quiz)))
    throw new CustomError(403, "Access denied")
  if (quiz.resultsPublished)
    throw new CustomError(400, "Results are already published")

  await repository.updateQuiz(quizId, { resultsPublished: true })
  return { resultsPublished: true }
}

/**
 * The ranked leaderboard for a community quiz. Hidden from plain members
 * until a moderator/admin publishes it; moderators/admins can preview it
 * early so they have something to decide "publish" against.
 */
const getLeaderboard = async (userId, quizId) => {
  if (!quizId) throw new CustomError(400, "Quiz ID is required")

  const quiz = await repository.getQuizById(quizId)
  if (!quiz) throw new CustomError(404, "Quiz not found")
  if (quiz.deleted) throw new CustomError(404, "Quiz not found")
  if (!quiz.community)
    throw new CustomError(400, "Only community quizzes have a leaderboard")
  if (!(await canAccessQuiz(userId, quiz)))
    throw new CustomError(403, "Access denied")

  const isManager = await canManageQuiz(userId, quiz)
  if (!quiz.resultsPublished && !isManager)
    throw new CustomError(403, "Results have not been published yet")

  const attempts = await repository.getAllAttemptsForQuiz(quizId)

  return {
    resultsPublished: quiz.resultsPublished,
    entries: attempts.map((attempt, index) => ({
      rank: index + 1,
      user: { _id: attempt.user?._id, name: attempt.user?.name },
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      percentage:
        attempt.totalQuestions > 0
          ? Math.round((attempt.score / attempt.totalQuestions) * 100)
          : 0,
      timeTaken: attempt.timeTaken,
      isYou: attempt.user?._id?.toString() === userId.toString()
    }))
  }
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
  getAttemptById,
  publishResults,
  getLeaderboard
}
