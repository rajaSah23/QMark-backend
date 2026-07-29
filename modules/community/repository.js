"use strict"

const Community = require("./model")
const CommunityMember = require("./memberModel")
const CommunityMembershipRequest = require("./membershipRequestModel")
const CommunityReaction = require("./reactionModel")
const CustomError = require("../../utils/CustomError")

// ─── Community ────────────────────────────────────────────────────────────────

const aggregateCommunities = (pipeline) => Community.aggregate(pipeline)

const createCommunity = (data) => Community.create(data)

const findCommunityById = async (communityId) => {
  const community = await Community.findOne({ _id: communityId, deleted: false })
  if (!community) throw new CustomError(404, "Community not found")
  return community
}

const findCommunityBySlug = async (slug) => {
  const community = await Community.findOne({ slug, deleted: false })
  if (!community) throw new CustomError(404, "Community not found")
  return community
}

const slugExists = (slug) => Community.exists({ slug })

const updateCommunity = (communityId, data) =>
  Community.findByIdAndUpdate(communityId, data, { new: true })

const bumpCounters = (communityId, increments) =>
  Community.updateOne({ _id: communityId }, { $inc: increments })

// ─── Members ──────────────────────────────────────────────────────────────────

const addMember = (communityId, userId, role = "member") =>
  CommunityMember.create({ community: communityId, user: userId, role })

const findMember = (communityId, userId) =>
  CommunityMember.findOne({ community: communityId, user: userId })

const listMembers = (communityId) =>
  CommunityMember.find({ community: communityId })
    .populate("user", "name email profileImage")
    .sort({ role: 1, createdAt: 1 })
    .lean()

const removeMember = (communityId, userId) =>
  CommunityMember.deleteOne({ community: communityId, user: userId })

const setMemberRole = (communityId, userId, role) =>
  CommunityMember.findOneAndUpdate(
    { community: communityId, user: userId },
    { $set: { role } },
    { new: true }
  )

const countMembersWithRole = (communityId, role) =>
  CommunityMember.countDocuments({ community: communityId, role })

const listUserMemberships = (userId) =>
  CommunityMember.find({ user: userId })
    .populate({
      path: "community",
      match: { deleted: false }
    })
    .lean()

// ─── Membership requests / invites ────────────────────────────────────────────

const createMembershipRequest = (data) => CommunityMembershipRequest.create(data)

const findPendingRequest = (communityId, userId, type) =>
  CommunityMembershipRequest.findOne({
    community: communityId,
    user: userId,
    type,
    status: "pending"
  })

const findRequestById = async (requestId) => {
  const found = await CommunityMembershipRequest.findById(requestId)
  if (!found) throw new CustomError(404, "Request not found")
  return found
}

const listPendingForCommunity = (communityId) =>
  CommunityMembershipRequest.find({ community: communityId, status: "pending" })
    .populate("user", "name email profileImage")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .lean()

const listPendingInvitesForUser = (userId) =>
  CommunityMembershipRequest.find({
    user: userId,
    type: "invite",
    status: "pending"
  })
    .populate("community", "name slug description visibility memberCount")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .lean()

const resolveRequest = (requestId, status, resolvedBy) =>
  CommunityMembershipRequest.findByIdAndUpdate(
    requestId,
    { $set: { status, resolvedBy, resolvedAt: new Date() } },
    { new: true }
  )

// ─── Reactions ────────────────────────────────────────────────────────────────

const findReaction = (communityId, userId) =>
  CommunityReaction.findOne({ community: communityId, user: userId })

const upsertReaction = (communityId, userId, value) =>
  CommunityReaction.findOneAndUpdate(
    { community: communityId, user: userId },
    { $set: { value } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )

const deleteReaction = (communityId, userId) =>
  CommunityReaction.deleteOne({ community: communityId, user: userId })

const findReactionsForUser = (userId, communityIds) =>
  CommunityReaction.find({ user: userId, community: { $in: communityIds } }).lean()

module.exports = {
  aggregateCommunities,
  createCommunity,
  findCommunityById,
  findCommunityBySlug,
  slugExists,
  updateCommunity,
  bumpCounters,
  addMember,
  findMember,
  listMembers,
  removeMember,
  setMemberRole,
  countMembersWithRole,
  listUserMemberships,
  createMembershipRequest,
  findPendingRequest,
  findRequestById,
  listPendingForCommunity,
  listPendingInvitesForUser,
  resolveRequest,
  findReaction,
  upsertReaction,
  deleteReaction,
  findReactionsForUser
}
