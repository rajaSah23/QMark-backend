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
    }
  },
  { timestamps: true }
)

UserQuestionStateSchema.index({ user: 1, question: 1 }, { unique: true })

module.exports = mongoose.model("UserQuestionState", UserQuestionStateSchema)
