"use strict"

const mongoose = require("mongoose")

/**
 * Covers both directions of joining a community:
 *
 *  - type "invite"  — a moderator/admin invited this user; the USER responds
 *  - type "request" — this user asked to join a private community; a
 *                     MODERATOR/ADMIN responds
 *
 * Keeping both in one collection means one state machine and one queue rather
 * than two near-identical ones.
 */
const CommunityMembershipRequestSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true
    },
    /** The user who would become a member. */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    type: {
      type: String,
      enum: ["invite", "request"],
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending"
    },
    /** Who created this record (the inviter for invites, the user for requests). */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    /** Who resolved it, once it leaves "pending". */
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    resolvedAt: { type: Date, default: null }
  },
  { timestamps: true }
)

// At most one pending record per user per community per direction.
CommunityMembershipRequestSchema.index(
  { community: 1, user: 1, type: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
)
CommunityMembershipRequestSchema.index({ user: 1, status: 1 })

module.exports = mongoose.model(
  "CommunityMembershipRequest",
  CommunityMembershipRequestSchema
)
