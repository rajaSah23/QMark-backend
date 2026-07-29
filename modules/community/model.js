"use strict"

const mongoose = require("mongoose")

const CommunitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public"
    },
    /**
     * When true, questions posted by members land in a pending queue until a
     * moderator approves them. Per-community, off by default.
     */
    requiresApproval: {
      type: Boolean,
      default: false
    },
    /** Exam subjects this community covers — drives discovery and filtering. */
    subjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "subject"
      }
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    // Denormalized counters so the listing page can sort without a join per row.
    memberCount: { type: Number, default: 0, min: 0 },
    questionCount: { type: Number, default: 0, min: 0 },
    likeCount: { type: Number, default: 0, min: 0 },
    dislikeCount: { type: Number, default: 0, min: 0 },
    deleted: { type: Boolean, default: false }
  },
  { timestamps: true }
)

CommunitySchema.index({ deleted: 1, visibility: 1 })
CommunitySchema.index({ name: 1 })

module.exports = mongoose.model("Community", CommunitySchema)
