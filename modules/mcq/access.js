"use strict"

const CommunityQuestion = require("../community/questionModel")
const CommunityMember = require("../community/memberModel")

/**
 * True when the question has been shared (and approved) into at least one
 * community the user belongs to.
 */
const isSharedWithUsersCommunity = async (userId, questionId) => {
  if (!questionId) return false

  const shares = await CommunityQuestion.find({
    question: questionId,
    status: "approved"
  })
    .select("community")
    .lean()

  if (shares.length === 0) return false

  const membership = await CommunityMember.exists({
    user: userId,
    community: { $in: shares.map((share) => share.community) }
  })

  return Boolean(membership)
}

/**
 * Decides whether a user may READ or ANSWER a question.
 *
 * This is the single seam through which question visibility flows. A user gets
 * access by authoring the question, or by belonging to a community it has been
 * shared into. Every read path calls this, so adding a rule here widens access
 * everywhere at once.
 *
 * Note this governs read/answer/bookmark only. Editing and deleting stay
 * author-only via canModifyQuestion — sharing a question into a community does
 * not hand editing rights to that community's members.
 *
 * @param {string} userId
 * @param {{ _id?: any, user: any }} question - an MCQ document or lean object
 * @returns {Promise<boolean>}
 */
const canAccessQuestion = async (userId, question) => {
  if (!userId || !question || !question.user) return false
  if (question.user.toString() === userId.toString()) return true
  return await isSharedWithUsersCommunity(userId, question._id)
}

/**
 * True when the user may modify (edit/delete) the question. Author-only, and
 * deliberately NOT widened by community membership.
 *
 * @param {string} userId
 * @param {{ user: any }} question - an MCQ document or lean object
 * @returns {boolean}
 */
const canModifyQuestion = (userId, question) => {
  if (!userId || !question || !question.user) return false
  return question.user.toString() === userId.toString()
}

module.exports = { canAccessQuestion, canModifyQuestion }
