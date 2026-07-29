"use strict"

const mongoose = require("mongoose")

/**
 * A user's like (1) or dislike (-1) on a community. One row per user per
 * community; re-sending the same value clears it, the opposite value flips it.
 */
const CommunityReactionSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    value: {
      type: Number,
      enum: [1, -1],
      required: true
    }
  },
  { timestamps: true }
)

CommunityReactionSchema.index({ community: 1, user: 1 }, { unique: true })

module.exports = mongoose.model("CommunityReaction", CommunityReactionSchema)
