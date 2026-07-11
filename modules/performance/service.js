"use strict"

const mongoose = require("mongoose")
const Activity = require("./model")
const repository = require("./repository")
const CustomError = require("../../utils/CustomError")

// ─── Activity Methods (merged from activityService.js) ────────────────────────

/**
 * Log activity for a user on today's date.
 * @param {string} userId
 * @param {string} activityType - e.g. 'QUESTION_ADDED', 'QUIZ_ATTEMPT'
 * @param {number} count
 */
const logActivity = async (userId, activityType, count = 1) => {
  try {
    const userId_obj = new mongoose.Types.ObjectId(userId)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let activity = await repository.findActivityByUserAndDate(userId_obj, today)

    if (!activity) {
      activity = new Activity({
        user: userId_obj,
        date: today,
        questionsAdded: 0,
        practiceSessions: 0,
        revisionsSessions: 0
      })
    }

    switch (activityType) {
      case "QUESTION_ADDED":
        activity.questionsAdded = (activity.questionsAdded || 0) + count
        break
      case "QUESTION_UPDATED":
        activity.questionsAdded = (activity.questionsAdded || 0) + count
        break
      case "PRACTICE_SESSION":
        activity.practiceSessions = (activity.practiceSessions || 0) + count
        activity.practiceAttempts = (activity.practiceAttempts || 0) + count
        break
      case "REVISION_SESSION":
        activity.revisionsSessions = (activity.revisionsSessions || 0) + count
        activity.revisionsAttempts = (activity.revisionsAttempts || 0) + count
        break
      case "QUIZ_ATTEMPT":
        activity.practiceSessions = (activity.practiceSessions || 0) + count
        activity.practiceAttempts = (activity.practiceAttempts || 0) + count
        break
      default:
        break
    }

    activity.totalActivity =
      (activity.questionsAdded || 0) +
      (activity.practiceSessions || 0) +
      (activity.revisionsSessions || 0)

    await repository.saveActivity(activity)
    return activity
  } catch (error) {
    console.error("Error logging activity:", error)
    // Activity tracking should never break the main flow
    return null
  }
}

/**
 * Batch log multiple activities.
 */
const logActivities = async (userId, activities) => {
  try {
    for (const activity of activities) {
      await logActivity(userId, activity.type, activity.count)
    }
    return true
  } catch (error) {
    console.error("Error batch logging activities:", error)
    return false
  }
}

// ─── Performance Methods (merged from performanceService.js) ──────────────────

const isEvaluatedAnswer = (answer) => !!answer?.selectedAnswer

/**
 * Get daily activity stats for a user within a date range.
 */
const getDailyActivityStats = async (userId, startDate, endDate) => {
  if (!userId) throw new CustomError(400, "User ID is required")

  const start = new Date(startDate)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  const activities = await repository.getActivitiesByDateRange(userId, start, end)

  return activities.map((activity) => ({
    date: activity.date.toISOString().split("T")[0],
    questionsAdded: activity.questionsAdded || 0,
    practiceSessions: activity.practiceSessions || 0,
    revisionsSessions: activity.revisionsSessions || 0,
    totalActivity: activity.totalActivity || 0
  }))
}

/**
 * Get user's current and longest streak.
 */
const getStreakRecord = async (userId) => {
  if (!userId) throw new CustomError(400, "User ID is required")

  const activities = await repository.getRecentActivities(userId, 365)

  if (activities.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActivityDate: null }
  }

  const dateStr = (d) => new Date(d).toISOString().split("T")[0]

  const activeDates = new Set(
    activities
      .filter((a) => (a.totalActivity || 0) > 0)
      .map((a) => dateStr(a.date))
  )

  let currentStreak = 0
  const todayStr = dateStr(new Date())
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterdayStr = dateStr(yesterdayDate)

  let startStr = null
  if (activeDates.has(todayStr)) startStr = todayStr
  else if (activeDates.has(yesterdayStr)) startStr = yesterdayStr

  if (startStr) {
    let d = new Date(startStr)
    while (activeDates.has(dateStr(d))) {
      currentStreak++
      d.setDate(d.getDate() - 1)
    }
  }

  const sortedDates = Array.from(activeDates)
    .sort()
    .map((s) => new Date(s))

  let longestStreak = sortedDates.length > 0 ? 1 : 0
  let tempStreak = longestStreak

  for (let i = 1; i < sortedDates.length; i++) {
    const diffDays = Math.round(
      (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24)
    )
    if (diffDays === 1) {
      tempStreak++
      longestStreak = Math.max(longestStreak, tempStreak)
    } else {
      tempStreak = 1
    }
  }

  return {
    currentStreak,
    longestStreak,
    lastActivityDate: activities[0]?.date || null
  }
}

/**
 * Get quiz performance stats for a user within a date range.
 */
const getQuizPerformanceStats = async (userId, startDate, endDate) => {
  if (!userId) throw new CustomError(400, "User ID is required")

  const start = new Date(startDate)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  const attempts = await repository.getAttemptsByDateRange(userId, start, end)

  return attempts.map((attempt) => ({
    _id: attempt._id,
    quizTitle: attempt.quiz?.title || "Untitled Quiz",
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    percentage:
      attempt.totalQuestions > 0
        ? Math.round((attempt.score / attempt.totalQuestions) * 100)
        : 0,
    timeTaken: attempt.timeTaken,
    date: attempt.createdAt.toISOString().split("T")[0]
  }))
}

/**
 * Get subject-wise performance.
 */
const getSubjectWisePerformance = async (userId, startDate, endDate) => {
  if (!userId) throw new CustomError(400, "User ID is required")

  const start = new Date(startDate)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  const attempts = await repository.getAttemptsWithSubject(userId, start, end)

  const subjectMap = {}

  for (const attempt of attempts) {
    for (const answer of attempt.answers) {
      if (
        answer.question &&
        answer.question.subject &&
        isEvaluatedAnswer(answer)
      ) {
        const subjectId = answer.question.subject._id.toString()
        const subjectName = answer.question.subject.subject || "Unknown"

        if (!subjectMap[subjectId]) {
          subjectMap[subjectId] = {
            subject: subjectName,
            quizzesTaken: new Set(),
            correctAnswers: 0,
            totalAnswers: 0,
            scores: []
          }
        }

        subjectMap[subjectId].quizzesTaken.add(attempt.quiz.toString())
        subjectMap[subjectId].totalAnswers++
        if (answer.isCorrect) subjectMap[subjectId].correctAnswers++
      }
    }
  }

  for (const attempt of attempts) {
    const attemptScore = (attempt.score / attempt.totalQuestions) * 100
    const subjects = new Set()

    for (const answer of attempt.answers) {
      if (
        answer.question &&
        answer.question.subject &&
        isEvaluatedAnswer(answer)
      ) {
        subjects.add(answer.question.subject._id.toString())
      }
    }

    for (const subjectId of subjects) {
      if (subjectMap[subjectId]) {
        subjectMap[subjectId].scores.push(attemptScore)
      }
    }
  }

  return Object.values(subjectMap).map((data) => ({
    subject: data.subject,
    quizzesTaken: data.quizzesTaken.size,
    correctAnswers: data.correctAnswers,
    totalAnswers: data.totalAnswers,
    averageScore:
      data.scores.length > 0
        ? Math.round(
            data.scores.reduce((a, b) => a + b, 0) / data.scores.length
          )
        : 0,
    bestScore: data.scores.length > 0 ? Math.max(...data.scores) : 0,
    accuracy:
      data.totalAnswers > 0
        ? Math.round((data.correctAnswers / data.totalAnswers) * 100)
        : 0
  }))
}

/**
 * Get difficulty-wise performance.
 */
const getDifficultyWisePerformance = async (userId, startDate, endDate) => {
  if (!userId) throw new CustomError(400, "User ID is required")

  const start = new Date(startDate)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  const attempts = await repository.getAttemptsWithDifficulty(userId, start, end)

  const difficultyMap = {
    Easy: { questionsSolved: 0, correctAnswers: 0, scores: [] },
    Medium: { questionsSolved: 0, correctAnswers: 0, scores: [] },
    Hard: { questionsSolved: 0, correctAnswers: 0, scores: [] }
  }

  for (const attempt of attempts) {
    const attemptScore = (attempt.score / attempt.totalQuestions) * 100

    for (const answer of attempt.answers) {
      if (answer.question && isEvaluatedAnswer(answer)) {
        const difficulty = answer.question.difficulty
          ? answer.question.difficulty.charAt(0).toUpperCase() +
            answer.question.difficulty.slice(1)
          : "Easy"

        if (difficultyMap[difficulty]) {
          difficultyMap[difficulty].questionsSolved++
          if (answer.isCorrect) difficultyMap[difficulty].correctAnswers++
          difficultyMap[difficulty].scores.push(attemptScore)
        }
      }
    }
  }

  return Object.entries(difficultyMap).map(([difficulty, data]) => ({
    difficulty,
    questionsSolved: data.questionsSolved,
    correctAnswers: data.correctAnswers,
    averageScore:
      data.scores.length > 0
        ? Math.round(
            data.scores.reduce((a, b) => a + b, 0) / data.scores.length
          )
        : 0,
    accuracy:
      data.questionsSolved > 0
        ? Math.round((data.correctAnswers / data.questionsSolved) * 100)
        : 0
  }))
}

/**
 * Get overall performance summary.
 */
const getPerformanceSummary = async (userId) => {
  if (!userId) throw new CustomError(400, "User ID is required")

  const attempts = await repository.getAllAttempts(userId)

  const questionCount = await repository.countMCQs({
    user: new mongoose.Types.ObjectId(userId),
    status: true
  })

  const totalQuestionsSolved = attempts.reduce((sum, attempt) => {
    return sum + attempt.answers.filter(isEvaluatedAnswer).length
  }, 0)

  const correctAnswers = attempts.reduce((sum, attempt) => {
    return sum + attempt.answers.filter((a) => a.isCorrect).length
  }, 0)

  const totalScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0)
  const totalQuestionCount = attempts.reduce(
    (sum, attempt) => sum + attempt.totalQuestions,
    0
  )

  const accuracyRate =
    totalQuestionsSolved > 0
      ? Math.round((correctAnswers / totalQuestionsSolved) * 100)
      : 0

  const averageScore =
    attempts.length > 0
      ? Math.round((totalScore / totalQuestionCount) * 100)
      : 0

  const timeSpentMinutes =
    attempts.reduce((sum, attempt) => sum + (attempt.timeTaken || 0), 0) / 60

  return {
    totalQuestionsSolved,
    quizzesCompleted: attempts.length,
    questionsCreated: questionCount,
    accuracyRate,
    averageScore,
    timeSpentMinutes: Math.round(timeSpentMinutes)
  }
}

module.exports = {
  // Activity (used by mcq and quiz modules via lazy require)
  logActivity,
  logActivities,
  // Performance analytics
  getDailyActivityStats,
  getStreakRecord,
  getQuizPerformanceStats,
  getSubjectWisePerformance,
  getDifficultyWisePerformance,
  getPerformanceSummary
}
