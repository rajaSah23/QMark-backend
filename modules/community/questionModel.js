"use strict"

const mongoose = require("mongoose")

/**
 * Links a question to a community it has been shared into.
 *
 * The question itself is never copied or moved — it stays a single MCQ owned by
 * its author, and this row is the grant of visibility. Unsharing deletes the
 * row; the question is untouched. A question may be shared into several
 * communities at once.
 */
const CommunityQuestionSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true
    },
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MCQ",
      required: true
    },
    /** Who shared it — normally, but not necessarily, the question's author. */
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    /**
     * "approved" grants visibility to members. Questions land in "pending" only
     * when the community has requiresApproval switched on.
     */
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved"
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    reviewedAt: { type: Date, default: null }
  },
  { timestamps: true }
)

CommunityQuestionSchema.index({ community: 1, question: 1 }, { unique: true })
CommunityQuestionSchema.index({ question: 1, status: 1 })
CommunityQuestionSchema.index({ community: 1, status: 1, createdAt: -1 })

module.exports = mongoose.model("CommunityQuestion", CommunityQuestionSchema)
