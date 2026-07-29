"use strict"

const CommunityMember = require("./memberModel")

const ROLE = {
  ADMIN: "admin",
  MODERATOR: "moderator",
  MEMBER: "member"
}

/** Rank used for "can act on" comparisons. Higher outranks lower. */
const ROLE_RANK = {
  [ROLE.ADMIN]: 3,
  [ROLE.MODERATOR]: 2,
  [ROLE.MEMBER]: 1
}

/**
 * The caller's role in a community, or null when they are not a member.
 * This is the single seam every community permission decision flows through.
 *
 * @param {string} userId
 * @param {string} communityId
 * @returns {Promise<"admin"|"moderator"|"member"|null>}
 */
const getMemberRole = async (userId, communityId) => {
  if (!userId || !communityId) return null
  const membership = await CommunityMember.findOne({
    community: communityId,
    user: userId
  }).lean()
  return membership ? membership.role : null
}

/** Members (any role) may see a community's questions, members and quizzes. */
const canViewContent = (role) => Boolean(role)

/** Moderators and admins may moderate questions and remove members. */
const canModerate = (role) => role === ROLE.ADMIN || role === ROLE.MODERATOR

/** Admins only: settings, role changes, deleting the community. */
const canAdminister = (role) => role === ROLE.ADMIN

/**
 * Whether `actorRole` may act on a member holding `targetRole`. A moderator
 * cannot remove or demote an admin, and no one may act on their own equal —
 * only a strictly higher rank wins.
 */
const outranks = (actorRole, targetRole) => {
  if (!actorRole || !targetRole) return false
  return (ROLE_RANK[actorRole] || 0) > (ROLE_RANK[targetRole] || 0)
}

/**
 * Whether a non-member may join without approval. Public communities are open;
 * private ones require an invite or an approved request.
 */
const canJoinDirectly = (community) =>
  Boolean(community) && community.visibility === "public"

module.exports = {
  ROLE,
  getMemberRole,
  canViewContent,
  canModerate,
  canAdminister,
  outranks,
  canJoinDirectly
}
