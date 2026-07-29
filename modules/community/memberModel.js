"use strict"

const mongoose = require("mongoose")

const ROLES = ["admin", "moderator", "member"]

const CommunityMemberSchema = new mongoose.Schema(
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
    role: {
      type: String,
      enum: ROLES,
      default: "member"
    }
  },
  { timestamps: true }
)

CommunityMemberSchema.index({ community: 1, user: 1 }, { unique: true })
CommunityMemberSchema.index({ user: 1 })

const CommunityMember = mongoose.model("CommunityMember", CommunityMemberSchema)

module.exports = CommunityMember
module.exports.ROLES = ROLES
