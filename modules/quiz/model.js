"use strict"

const mongoose = require("mongoose")

const QuizSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "subject",
      default: null
    },
    /** Set only for quizzes created inside a community; null for personal quizzes. */
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      default: null
    },
    /**
     * Community quizzes only. Individual attempts are always visible to their
     * own author; this gates the LEADERBOARD (everyone's rank) until an admin
     * or moderator publishes it.
     */
    resultsPublished: {
      type: Boolean,
      default: false
    },
    /**
     * Personal quizzes only (community quizzes are always exam-style
     * regardless of this flag). When true: one attempt per user, and — if
     * settings.timeLimit is set — the server rejects a submission reporting
     * a timeTaken beyond that limit. False (default) keeps today's
     * unlimited-attempts, unenforced-timing practice behaviour.
     */
    examMode: {
      type: Boolean,
      default: false
    },
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MCQ"
      }
    ],
    settings: {
      shuffleQuestions: { type: Boolean, default: false },
      shuffleOptions: { type: Boolean, default: false },
      timeLimit: { type: Number, default: 0, min: 0 } // 0 = no limit (minutes)
    },
    active: { type: Boolean, default: true },
    deleted: { type: Boolean, default: false }
  },
  { timestamps: true }
)

const Quiz = mongoose.model("Quiz", QuizSchema)
module.exports = Quiz
