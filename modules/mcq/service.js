"use strict"

const mongoose = require("mongoose")
const MCQ = require("./model")
const QuestionOptionClick = require("./optionClickModel")
const repository = require("./repository")
const CustomError = require("../../utils/CustomError")
const {
  buildQuestionMatchStage,
  buildCreatedAtFilter,
  buildQuestionSortStages
} = require("../../utils/queryBuilder")
const {
  addQuestionCommentSchema,
  trackQuestionInteractionSchema,
  createMCQSchema
} = require("./joiSchema")

// ─── Internal Helper: Interaction Stats ───────────────────────────────────────

const getInteractionStatsByQuestion = async (userId, questionIds = []) => {
  if (!userId || questionIds.length === 0) return {}

  const response = await QuestionOptionClick.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        question: {
          $in: questionIds.map((id) => new mongoose.Types.ObjectId(id))
        }
      }
    },
    {
      $group: {
        _id: "$question",
        totalClicks: { $sum: 1 },
        correctClicks: { $sum: { $cond: ["$isCorrect", 1, 0] } },
        incorrectClicks: { $sum: { $cond: ["$isCorrect", 0, 1] } },
        lastClickedAt: { $max: "$createdAt" }
      }
    }
  ])

  return response.reduce((acc, item) => {
    const totalClicks = item.totalClicks || 0
    acc[item._id.toString()] = {
      totalClicks,
      correctClicks: item.correctClicks || 0,
      incorrectClicks: item.incorrectClicks || 0,
      accuracy:
        totalClicks > 0
          ? Math.round(((item.correctClicks || 0) / totalClicks) * 100)
          : 0,
      lastClickedAt: item.lastClickedAt || null
    }
    return acc
  }, {})
}

// ─── Service Methods ──────────────────────────────────────────────────────────

const getMCQs = async (userId, query) => {
  const matchStage = buildQuestionMatchStage(userId, query)

  const countResult = await repository.aggregateMCQs([
    { $match: matchStage },
    { $count: "total" }
  ])
  const total = countResult[0]?.total || 0

  const page = parseInt(query?.page) || 1
  const limit = parseInt(query?.limit) || 10
  const skip = (page - 1) * limit
  const { stages: sortStages, meta: sortMeta } = buildQuestionSortStages(query)

  const aggPipeline = [
    { $match: matchStage },
    ...sortStages,
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: "subjects",
        localField: "subject",
        foreignField: "_id",
        as: "subject"
      }
    },
    { $unwind: { path: "$subject", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "topics",
        localField: "topic",
        foreignField: "_id",
        as: "topic"
      }
    },
    { $unwind: { path: "$topic", preserveNullAndEmptyArrays: true } }
  ]

  const results = await repository.aggregateMCQs(aggPipeline)
  const interactionStats = await getInteractionStatsByQuestion(
    userId,
    results.map((item) => item._id.toString())
  )

  const emptyStats = {
    totalClicks: 0,
    correctClicks: 0,
    incorrectClicks: 0,
    accuracy: 0,
    lastClickedAt: null
  }

  const resultsWithAnalytics = results.map((item) => ({
    ...item,
    interactionStats: interactionStats[item._id.toString()] || emptyStats
  }))

  return {
    results: resultsWithAnalytics,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    sortBy: sortMeta.sortBy,
    sortDirection: sortMeta.sortDirection,
    randomSeed: sortMeta.randomSeed
  }
}

const getMCQById = async (userId, params) => {
  if (!userId) throw new CustomError(400, "User ID is required")

  const mcq = await repository.getMCQById(params.questionId)
  if (!mcq.user || mcq.user.toString() !== userId)
    throw new CustomError(403, "You are not authorized to access this question")

  return await repository.getMCQById(params.questionId)
}

const deleteMCQById = async (userId, params) => {
  if (!userId) throw new CustomError(400, "User ID is required")

  const mcq = await repository.getMCQById(params.questionId)
  if (mcq.user.toString() !== userId)
    throw new CustomError(403, "You are not authorized to delete this question")

  return await repository.deleteMCQById(params.questionId)
}

const postMCQs = async (userId, body) => {
  if (!userId) throw new CustomError(400, "User ID is required")

  const data = { user: userId }
  if (body.question) data.question = body.question
  if (body.options) data.options = body.options
  if (body.correctAnswer) data.correctAnswer = body.correctAnswer
  if (body.difficulty) data.difficulty = body.difficulty
  if (body.tag) data.tag = body.tag
  if (body.subject) data.subject = body.subject
  if (body.topic) data.topic = body.topic
  if (body.explanation) data.explanation = body.explanation
  if (body.status) data.status = body.status

  const { error } = createMCQSchema.validate(data)
  if (error) throw new CustomError(400, error.details[0].message)

  const response = await repository.postMCQs(data)

  // Log activity (imported lazily to avoid circular dependency)
  const activityService = require("../performance/service")
  await activityService.logActivity(userId, "QUESTION_ADDED", 1)

  return response
}

const updateMCQ = async (userId, body) => {
  if (!userId) throw new CustomError(400, "User ID is required")

  const mcq = await repository.getMCQById(body.questionId)
  if (mcq.user.toString() !== userId)
    throw new CustomError(403, "You are not authorized to update this question")

  const questionId = body.questionId
  const data = {}
  if (body.question) data.question = body.question
  if (body.options) data.options = body.options
  if (body.tag) data.tag = body.tag
  if (body.correctAnswer) data.correctAnswer = body.correctAnswer
  if (body.difficulty) data.difficulty = body.difficulty
  if (body.subject) data.subject = body.subject
  if (body.topic) data.topic = body.topic
  if (body.explanation) data.explanation = body.explanation
  if (body.status !== undefined) data.status = body.status

  const response = await repository.updateMCQ(questionId, data)

  const activityService = require("../performance/service")
  await activityService.logActivity(userId, "QUESTION_UPDATED", 1)

  return response
}

const bookmarkQuestion = async (userId, body) => {
  if (!userId) throw new CustomError(400, "User ID is required")

  const mcq = await repository.getQuestion({ _id: body.questionId, user: userId })
  if (!mcq) throw new CustomError(404, "Question not found")

  return await repository.updateMCQ(body.questionId, { bookmark: body.bookmark })
}

const trackOptionClick = async (userId, questionId, body) => {
  if (!userId) throw new CustomError(400, "User ID is required")
  if (!questionId) throw new CustomError(400, "Question ID is required")

  const { error, value } = trackQuestionInteractionSchema.validate(body)
  if (error) throw new CustomError(400, error.details[0].message)

  const mcq = await repository.getQuestion({ _id: questionId, user: userId })
  if (!mcq) throw new CustomError(404, "Question not found")

  if (!mcq.options.includes(value.selectedAnswer)) {
    throw new CustomError(400, "Selected answer is invalid for this question")
  }

  const isCorrect = mcq.correctAnswer === value.selectedAnswer

  await QuestionOptionClick.create({
    user: userId,
    question: questionId,
    selectedAnswer: value.selectedAnswer,
    isCorrect
  })

  const statsMap = await getInteractionStatsByQuestion(userId, [questionId])

  return {
    questionId,
    selectedAnswer: value.selectedAnswer,
    isCorrect,
    stats: statsMap[questionId] || {
      totalClicks: 0,
      correctClicks: 0,
      incorrectClicks: 0,
      accuracy: 0,
      lastClickedAt: null
    }
  }
}

const getQuestionInteractionSummary = async (userId, query) => {
  if (!userId) throw new CustomError(400, "User ID is required")

  const matchStage = buildQuestionMatchStage(userId, query)
  const createdAtFilter = buildCreatedAtFilter(query)

  const questions = await MCQ.find(matchStage)
    .select("_id question subject")
    .populate("subject", "subject")
    .lean()

  const questionIds = questions.map((item) => item._id)

  if (questionIds.length === 0) {
    return {
      totalClicks: 0,
      uniqueQuestionsAttempted: 0,
      correctClicks: 0,
      incorrectClicks: 0,
      accuracy: 0,
      questionBreakdown: []
    }
  }

  const groupedStats = await QuestionOptionClick.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        question: { $in: questionIds },
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {})
      }
    },
    {
      $group: {
        _id: "$question",
        totalClicks: { $sum: 1 },
        correctClicks: { $sum: { $cond: ["$isCorrect", 1, 0] } },
        incorrectClicks: { $sum: { $cond: ["$isCorrect", 0, 1] } },
        lastClickedAt: { $max: "$createdAt" }
      }
    },
    { $sort: { lastClickedAt: -1 } }
  ])

  const questionMap = questions.reduce((acc, item) => {
    acc[item._id.toString()] = item
    return acc
  }, {})

  const questionBreakdown = groupedStats.map((item) => {
    const totalClicks = item.totalClicks || 0
    const question = questionMap[item._id.toString()]
    return {
      questionId: item._id,
      question: question?.question || "Question unavailable",
      subject: question?.subject?.subject || "Unassigned",
      totalClicks,
      correctClicks: item.correctClicks || 0,
      incorrectClicks: item.incorrectClicks || 0,
      accuracy:
        totalClicks > 0
          ? Math.round(((item.correctClicks || 0) / totalClicks) * 100)
          : 0,
      lastClickedAt: item.lastClickedAt || null
    }
  })

  const totalClicks = questionBreakdown.reduce(
    (sum, item) => sum + item.totalClicks,
    0
  )
  const correctClicks = questionBreakdown.reduce(
    (sum, item) => sum + item.correctClicks,
    0
  )
  const incorrectClicks = questionBreakdown.reduce(
    (sum, item) => sum + item.incorrectClicks,
    0
  )

  return {
    totalClicks,
    uniqueQuestionsAttempted: questionBreakdown.length,
    correctClicks,
    incorrectClicks,
    accuracy:
      totalClicks > 0 ? Math.round((correctClicks / totalClicks) * 100) : 0,
    questionBreakdown
  }
}

const getQuestionInteractionDetail = async (userId, questionId, query) => {
  if (!userId) throw new CustomError(400, "User ID is required")
  if (!questionId) throw new CustomError(400, "Question ID is required")

  const createdAtFilter = buildCreatedAtFilter(query)

  const question = await MCQ.findOne({ _id: questionId, user: userId })
    .populate("subject", "subject")
    .populate("topic", "topic")
    .populate("comments.user", "name email")
    .lean()

  if (!question) throw new CustomError(404, "Question not found")

  const clickQuery = {
    user: new mongoose.Types.ObjectId(userId),
    question: new mongoose.Types.ObjectId(questionId),
    ...(createdAtFilter ? { createdAt: createdAtFilter } : {})
  }

  const clickHistory = await QuestionOptionClick.find(clickQuery)
    .sort({ createdAt: -1 })
    .limit(200)
    .lean()

  const totalClicks = clickHistory.length
  const correctClicks = clickHistory.filter((item) => item.isCorrect).length
  const incorrectClicks = totalClicks - correctClicks

  const optionBreakdown = question.options.map((option) => {
    const clicks = clickHistory.filter(
      (item) => item.selectedAnswer === option
    ).length
    const correct = clickHistory.filter(
      (item) => item.selectedAnswer === option && item.isCorrect
    ).length
    return { option, clicks, correct, incorrect: clicks - correct }
  })

  return {
    question: {
      _id: question._id,
      question: question.question,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      difficulty: question.difficulty,
      subject: question.subject,
      topic: question.topic
    },
    summary: {
      totalClicks,
      correctClicks,
      incorrectClicks,
      accuracy:
        totalClicks > 0 ? Math.round((correctClicks / totalClicks) * 100) : 0
    },
    optionBreakdown,
    clickHistory,
    comments: question.comments || []
  }
}

const addQuestionComment = async (userId, questionId, body) => {
  if (!userId) throw new CustomError(400, "User ID is required")
  if (!questionId) throw new CustomError(400, "Question ID is required")

  const { error, value } = addQuestionCommentSchema.validate(body)
  if (error) throw new CustomError(400, error.details[0].message)

  const question = await repository.getQuestion({ _id: questionId, user: userId })
  if (!question) throw new CustomError(404, "Question not found")

  question.comments = question.comments || []
  question.comments.push({ user: userId, comment: value.comment })
  await question.save()

  const updatedQuestion = await MCQ.findById(questionId)
    .populate("comments.user", "name email")
    .lean()

  return updatedQuestion?.comments || []
}

module.exports = {
  getMCQs,
  getMCQById,
  deleteMCQById,
  postMCQs,
  updateMCQ,
  bookmarkQuestion,
  trackOptionClick,
  getQuestionInteractionSummary,
  getQuestionInteractionDetail,
  addQuestionComment
}
