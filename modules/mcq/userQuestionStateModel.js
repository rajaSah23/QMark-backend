"use strict"

const mongoose = require("mongoose")

/**
 * Per-user state for a question. Keeps user-specific data (bookmarks today,
 * spaced-repetition scheduling later) off the shared MCQ document so that two
 * users can hold different state for the same question.
 */
const UserQuestionStateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MCQ",
      required: true
    },
    bookmarked: {
      type: Boolean,
      default: false
    },
    // ─── Spaced repetition (SM-2), set the moment a question is first
    // answered via trackOptionClick; see modules/mcq/srs.js ────────────────
    easeFactor: {
      type: Number,
      default: 2.5
    },
    interval: {
      type: Number,
      default: 0
    },
    repetitions: {
      type: Number,
      default: 0
    },
    /** null until first answered; the review queue is "due <= now". */
    nextReviewAt: {
      type: Date,
      default: null
    },
    lastReviewedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
)

UserQuestionStateSchema.index({ user: 1, question: 1 }, { unique: true })
UserQuestionStateSchema.index({ user: 1, nextReviewAt: 1 })

module.exports = mongoose.model("UserQuestionState", UserQuestionStateSchema)
