"use strict"

const mongoose = require("mongoose")
const User = require("../user/userModel")
const repository = require("./repository")
const CustomError = require("../../utils/CustomError")
const {
  ROLE,
  getMemberRole,
  canViewContent,
  canModerate,
  canAdminister,
  outranks,
  canJoinDirectly
} = require("./access")
const {
  createCommunitySchema,
  updateCommunitySchema,
  reactSchema,
  inviteSchema,
  respondSchema,
  changeRoleSchema
} = require("./joiSchema")

// ─── Internal helpers ─────────────────────────────────────────────────────────

const slugify = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

/** Produces a slug that is unique across communities, suffixing on collision. */
const buildUniqueSlug = async (name) => {
  const base = slugify(name) || "community"
  let candidate = base
  let suffix = 1
  // Bounded so a pathological collision run cannot spin forever.
  while (suffix < 100 && (await repository.slugExists(candidate))) {
    suffix += 1
    candidate = `${base}-${suffix}`
  }
  if (await repository.slugExists(candidate)) {
    candidate = `${base}-${Date.now()}`
  }
  return candidate
}

/** Strips members-only fields from a community the caller cannot see into. */
const toListItem = (community, viewerRole, viewerReaction) => ({
  _id: community._id,
  name: community.name,
  slug: community.slug,
  description: community.description,
  visibility: community.visibility,
  subjects: community.subjects || [],
  memberCount: community.memberCount || 0,
  questionCount: community.questionCount || 0,
  likeCount: community.likeCount || 0,
  dislikeCount: community.dislikeCount || 0,
  score: (community.likeCount || 0) - (community.dislikeCount || 0),
  createdAt: community.createdAt,
  viewerRole: viewerRole || null,
  isMember: Boolean(viewerRole),
  viewerReaction: viewerReaction || 0
})

const assertCommunityAccess = async (userId, community) => {
  const role = await getMemberRole(userId, community._id)
  if (!canViewContent(role))
    throw new CustomError(403, "Join this community to view its content")
  return role
}

// ─── Listing ──────────────────────────────────────────────────────────────────

/**
 * Public listing. Private communities ARE listed (name + description only) so
 * that request-to-join is reachable; their content stays members-only.
 */
const listCommunities = async (userId, query = {}) => {
  const match = { deleted: false }

  if (query.search) {
    const regex = new RegExp(query.search, "i")
    match.$or = [{ name: regex }, { description: regex }]
  }

  if (query.visibility && ["public", "private"].includes(query.visibility)) {
    match.visibility = query.visibility
  }

  if (query.subject && mongoose.Types.ObjectId.isValid(query.subject)) {
    match.subjects = new mongoose.Types.ObjectId(query.subject)
  }

  if (query.mine === "true" && userId) {
    const memberships = await repository.listUserMemberships(userId)
    match._id = { $in: memberships.map((m) => m.community?._id).filter(Boolean) }
  }

  const sortMap = {
    top: { score: -1, memberCount: -1, _id: 1 },
    popular: { memberCount: -1, _id: 1 },
    newest: { createdAt: -1, _id: 1 },
    name: { name: 1, _id: 1 }
  }
  const sortBy = sortMap[query.sortBy] ? query.sortBy : "top"

  const page = parseInt(query.page) || 1
  const limit = Math.min(parseInt(query.limit) || 12, 50)
  const skip = (page - 1) * limit

  const basePipeline = [
    { $match: match },
    { $addFields: { score: { $subtract: ["$likeCount", "$dislikeCount"] } } }
  ]

  const countResult = await repository.aggregateCommunities([
    ...basePipeline,
    { $count: "total" }
  ])
  const total = countResult[0]?.total || 0

  const results = await repository.aggregateCommunities([
    ...basePipeline,
    { $sort: sortMap[sortBy] },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: "subjects",
        localField: "subjects",
        foreignField: "_id",
        as: "subjects"
      }
    }
  ])

  // Annotate with the caller's own membership and reaction.
  const ids = results.map((c) => c._id)
  const [memberships, reactions] = await Promise.all([
    userId
      ? mongoose
          .model("CommunityMember")
          .find({ user: userId, community: { $in: ids } })
          .lean()
      : [],
    userId ? repository.findReactionsForUser(userId, ids) : []
  ])

  const roleByCommunity = memberships.reduce((acc, m) => {
    acc[m.community.toString()] = m.role
    return acc
  }, {})
  const reactionByCommunity = reactions.reduce((acc, r) => {
    acc[r.community.toString()] = r.value
    return acc
  }, {})

  return {
    results: results.map((c) =>
      toListItem(
        c,
        roleByCommunity[c._id.toString()],
        reactionByCommunity[c._id.toString()]
      )
    ),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    sortBy
  }
}

// ─── Create / read / update / delete ──────────────────────────────────────────

const createCommunity = async (userId, body) => {
  if (!userId) throw new CustomError(400, "User ID is required")

  const { error, value } = createCommunitySchema.validate(body)
  if (error) throw new CustomError(400, error.details[0].message)

  const slug = await buildUniqueSlug(value.name)

  const community = await repository.createCommunity({
    ...value,
    slug,
    createdBy: userId,
    memberCount: 1
  })

  // The creator is always the first admin.
  await repository.addMember(community._id, userId, ROLE.ADMIN)

  return toListItem(community.toObject(), ROLE.ADMIN, 0)
}

const getCommunityBySlug = async (userId, slug) => {
  const community = await repository.findCommunityBySlug(slug)
  const role = await getMemberRole(userId, community._id)
  const reaction = await repository.findReaction(community._id, userId)

  const base = toListItem(community.toObject(), role, reaction?.value || 0)

  return {
    ...base,
    requiresApproval: community.requiresApproval,
    createdBy: community.createdBy,
    // Content is members-only, whatever the community's visibility.
    canViewContent: canViewContent(role)
  }
}

const updateCommunity = async (userId, communityId, body) => {
  const community = await repository.findCommunityById(communityId)
  const role = await getMemberRole(userId, community._id)
  if (!canAdminister(role))
    throw new CustomError(403, "Only a community admin can change settings")

  const { error, value } = updateCommunitySchema.validate(body)
  if (error) throw new CustomError(400, error.details[0].message)

  const updated = await repository.updateCommunity(communityId, value)
  return toListItem(updated.toObject(), role, 0)
}

const deleteCommunity = async (userId, communityId) => {
  const community = await repository.findCommunityById(communityId)
  const role = await getMemberRole(userId, community._id)
  if (!canAdminister(role))
    throw new CustomError(403, "Only a community admin can delete it")

  await repository.updateCommunity(communityId, { deleted: true })
  return { _id: communityId, deleted: true }
}

// ─── Joining / leaving ────────────────────────────────────────────────────────

const joinCommunity = async (userId, communityId) => {
  const community = await repository.findCommunityById(communityId)

  const existingRole = await getMemberRole(userId, community._id)
  if (existingRole) throw new CustomError(400, "You are already a member")

  if (canJoinDirectly(community)) {
    await repository.addMember(community._id, userId, ROLE.MEMBER)
    await repository.bumpCounters(community._id, { memberCount: 1 })
    return { joined: true, status: "member" }
  }

  // Private: an accepted invite short-circuits the approval queue.
  const invite = await repository.findPendingRequest(
    community._id,
    userId,
    "invite"
  )
  if (invite) {
    await repository.addMember(community._id, userId, ROLE.MEMBER)
    await repository.bumpCounters(community._id, { memberCount: 1 })
    await repository.resolveRequest(invite._id, "accepted", userId)
    return { joined: true, status: "member" }
  }

  const pending = await repository.findPendingRequest(
    community._id,
    userId,
    "request"
  )
  if (pending) throw new CustomError(400, "Your join request is already pending")

  await repository.createMembershipRequest({
    community: community._id,
    user: userId,
    type: "request",
    createdBy: userId
  })

  return { joined: false, status: "pending" }
}

const leaveCommunity = async (userId, communityId) => {
  const community = await repository.findCommunityById(communityId)
  const role = await getMemberRole(userId, community._id)
  if (!role) throw new CustomError(400, "You are not a member of this community")

  if (role === ROLE.ADMIN) {
    const adminCount = await repository.countMembersWithRole(
      community._id,
      ROLE.ADMIN
    )
    if (adminCount <= 1)
      throw new CustomError(
        400,
        "Promote another admin before leaving — a community cannot be left without one"
      )
  }

  await repository.removeMember(community._id, userId)
  await repository.bumpCounters(community._id, { memberCount: -1 })
  return { left: true }
}

// ─── Reactions ────────────────────────────────────────────────────────────────

const reactToCommunity = async (userId, communityId, body) => {
  const { error, value } = reactSchema.validate(body)
  if (error) throw new CustomError(400, error.details[0].message)

  const community = await repository.findCommunityById(communityId)

  if (community.visibility === "private") {
    const role = await getMemberRole(userId, community._id)
    if (!canViewContent(role))
      throw new CustomError(403, "Only members can react to a private community")
  }

  const existing = await repository.findReaction(community._id, userId)

  // Same value again clears the reaction; the opposite flips it.
  if (existing && existing.value === value.value) {
    await repository.deleteReaction(community._id, userId)
    await repository.bumpCounters(community._id, {
      [value.value === 1 ? "likeCount" : "dislikeCount"]: -1
    })
    return { viewerReaction: 0 }
  }

  const increments = {}
  if (existing) {
    increments[existing.value === 1 ? "likeCount" : "dislikeCount"] = -1
  }
  increments[value.value === 1 ? "likeCount" : "dislikeCount"] =
    (increments[value.value === 1 ? "likeCount" : "dislikeCount"] || 0) + 1

  await repository.upsertReaction(community._id, userId, value.value)
  await repository.bumpCounters(community._id, increments)

  return { viewerReaction: value.value }
}

// ─── Members ──────────────────────────────────────────────────────────────────

const listMembers = async (userId, communityId) => {
  const community = await repository.findCommunityById(communityId)
  await assertCommunityAccess(userId, community)
  return await repository.listMembers(community._id)
}

const changeMemberRole = async (userId, communityId, targetUserId, body) => {
  const { error, value } = changeRoleSchema.validate(body)
  if (error) throw new CustomError(400, error.details[0].message)

  const community = await repository.findCommunityById(communityId)
  const actorRole = await getMemberRole(userId, community._id)
  if (!canAdminister(actorRole))
    throw new CustomError(403, "Only a community admin can change roles")

  if (userId.toString() === targetUserId.toString())
    throw new CustomError(400, "You cannot change your own role")

  const target = await repository.findMember(community._id, targetUserId)
  if (!target) throw new CustomError(404, "That user is not a member")

  // Demoting the last admin would strand the community.
  if (target.role === ROLE.ADMIN && value.role !== ROLE.ADMIN) {
    const adminCount = await repository.countMembersWithRole(
      community._id,
      ROLE.ADMIN
    )
    if (adminCount <= 1)
      throw new CustomError(400, "A community must keep at least one admin")
  }

  const updated = await repository.setMemberRole(
    community._id,
    targetUserId,
    value.role
  )
  return { user: targetUserId, role: updated.role }
}

const removeMember = async (userId, communityId, targetUserId) => {
  const community = await repository.findCommunityById(communityId)
  const actorRole = await getMemberRole(userId, community._id)
  if (!canModerate(actorRole))
    throw new CustomError(403, "You are not allowed to remove members")

  const target = await repository.findMember(community._id, targetUserId)
  if (!target) throw new CustomError(404, "That user is not a member")

  if (userId.toString() === targetUserId.toString())
    throw new CustomError(400, "Use leave to remove yourself")

  if (!outranks(actorRole, target.role))
    throw new CustomError(403, "You cannot remove a member of equal or higher role")

  await repository.removeMember(community._id, targetUserId)
  await repository.bumpCounters(community._id, { memberCount: -1 })
  return { removed: true }
}

// ─── Invites and join requests ────────────────────────────────────────────────

const inviteUser = async (userId, communityId, body) => {
  const { error, value } = inviteSchema.validate(body)
  if (error) throw new CustomError(400, error.details[0].message)

  const community = await repository.findCommunityById(communityId)
  const actorRole = await getMemberRole(userId, community._id)
  if (!canModerate(actorRole))
    throw new CustomError(403, "You are not allowed to invite people")

  const invitee = value.userId
    ? await User.findById(value.userId)
    : await User.findOne({ email: value.email })
  if (!invitee) throw new CustomError(404, "No such user")

  const alreadyMember = await getMemberRole(invitee._id, community._id)
  if (alreadyMember) throw new CustomError(400, "That user is already a member")

  const pending = await repository.findPendingRequest(
    community._id,
    invitee._id,
    "invite"
  )
  if (pending) throw new CustomError(400, "That user already has a pending invite")

  const created = await repository.createMembershipRequest({
    community: community._id,
    user: invitee._id,
    type: "invite",
    createdBy: userId
  })

  return { _id: created._id, user: invitee._id, status: created.status }
}

const listPendingRequests = async (userId, communityId) => {
  const community = await repository.findCommunityById(communityId)
  const actorRole = await getMemberRole(userId, community._id)
  if (!canModerate(actorRole))
    throw new CustomError(403, "You are not allowed to view join requests")

  return await repository.listPendingForCommunity(community._id)
}

const listMyInvitations = async (userId) =>
  await repository.listPendingInvitesForUser(userId)

/**
 * Resolves an invite or a join request. Who may respond depends on direction:
 * the invited user answers an invite; a moderator answers a join request.
 */
const respondToRequest = async (userId, requestId, body) => {
  const { error, value } = respondSchema.validate(body)
  if (error) throw new CustomError(400, error.details[0].message)

  const found = await repository.findRequestById(requestId)
  if (found.status !== "pending")
    throw new CustomError(400, "That request has already been resolved")

  const community = await repository.findCommunityById(found.community)

  if (found.type === "invite") {
    if (found.user.toString() !== userId.toString())
      throw new CustomError(403, "This invite is not addressed to you")
  } else {
    const actorRole = await getMemberRole(userId, community._id)
    if (!canModerate(actorRole))
      throw new CustomError(403, "You are not allowed to answer join requests")
  }

  if (value.action === "reject") {
    await repository.resolveRequest(found._id, "rejected", userId)
    return { status: "rejected" }
  }

  const alreadyMember = await getMemberRole(found.user, community._id)
  if (!alreadyMember) {
    await repository.addMember(community._id, found.user, ROLE.MEMBER)
    await repository.bumpCounters(community._id, { memberCount: 1 })
  }
  await repository.resolveRequest(found._id, "accepted", userId)

  return { status: "accepted" }
}

module.exports = {
  listCommunities,
  createCommunity,
  getCommunityBySlug,
  updateCommunity,
  deleteCommunity,
  joinCommunity,
  leaveCommunity,
  reactToCommunity,
  listMembers,
  changeMemberRole,
  removeMember,
  inviteUser,
  listPendingRequests,
  listMyInvitations,
  respondToRequest
}
