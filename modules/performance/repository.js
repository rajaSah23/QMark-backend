"use strict"

const mongoose = require("mongoose")
const Activity = require("./model")
const MCQ = require("../mcq/model")
const QuizAttempt = require("../quiz/attemptModel")

// ─── Activity Repository ───────────────────────────────────────────────────────

/**
 * Find an activity document for a user on a specific date.
 */
const findActivityByUserAndDate = (userId, date) =>
  Activity.findOne({ user: userId, date })

/**
 * Save (upsert) an activity document.
 */
const saveActivity = (activity) => activity.save()

/**
 * Get all activities for a user within a date range, ascending by date.
 */
const getActivitiesByDateRange = (userId, start, end) =>
  Activity.find({
    user: new mongoose.Types.ObjectId(userId),
    date: { $gte: start, $lte: end }
  }).sort({ date: 1 })

/**
 * Get recent activities for a user (for streak calculation), descending.
 */
const getRecentActivities = (userId, limit = 365) =>
  Activity.find({ user: new mongoose.Types.ObjectId(userId) })
    .sort({ date: -1 })
    .limit(limit)

// ─── MCQ / Quiz Repository (performance reads) ────────────────────────────────

/**
 * Count MCQ documents matching condition.
 */
const countMCQs = (condition) => MCQ.countDocuments(condition)

/**
 * Get all quiz attempts for a user within date range, populating quiz title.
 */
const getAttemptsByDateRange = (userId, start, end) =>
  QuizAttempt.find({
    user: new mongoose.Types.ObjectId(userId),
    createdAt: { $gte: start, $lte: end }
  })
    .populate("quiz", "title")
    .sort({ createdAt: -1 })

/**
 * Get all attempts for a user (for summary), with no date filter.
 */
const getAllAttempts = (userId) =>
  QuizAttempt.find({ user: new mongoose.Types.ObjectId(userId) })

/**
 * Get attempts with populated subject data (for subject-wise performance).
 */
const getAttemptsWithSubject = (userId, start, end) =>
  QuizAttempt.find({
    user: new mongoose.Types.ObjectId(userId),
    createdAt: { $gte: start, $lte: end }
  })
    .populate({
      path: "answers.question",
      select: "subject",
      populate: { path: "subject", select: "subject" }
    })
    .exec()

/**
 * Get attempts with populated difficulty data (for difficulty-wise performance).
 */
const getAttemptsWithDifficulty = (userId, start, end) =>
  QuizAttempt.find({
    user: new mongoose.Types.ObjectId(userId),
    createdAt: { $gte: start, $lte: end }
  })
    .populate({ path: "answers.question", select: "difficulty correctAnswer" })
    .exec()

module.exports = {
  findActivityByUserAndDate,
  saveActivity,
  getActivitiesByDateRange,
  getRecentActivities,
  countMCQs,
  getAttemptsByDateRange,
  getAllAttempts,
  getAttemptsWithSubject,
  getAttemptsWithDifficulty
}
