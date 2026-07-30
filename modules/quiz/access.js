"use strict"

const { getMemberRole, canModerate } = require("../community/access")

/**
 * Whether a user may view/attempt a quiz.
 *
 * Personal quizzes (no community): author only, unchanged from before
 * communities existed. Community quizzes: any member of that community.
 *
 * @param {string} userId
 * @param {{ user: any, community?: any }} quiz
 * @returns {Promise<boolean>}
 */
const canAccessQuiz = async (userId, quiz) => {
  if (!userId || !quiz) return false
  if (!quiz.community) return quiz.user.toString() === userId.toString()

  const role = await getMemberRole(userId, quiz.community)
  return Boolean(role)
}

/**
 * Whether a user may edit/delete/publish a quiz.
 *
 * Personal quizzes: author only. Community quizzes: moderators and admins of
 * that community — matches "only moderators/admins may create community
 * quizzes", so the same roles manage them afterward.
 *
 * @param {string} userId
 * @param {{ user: any, community?: any }} quiz
 * @returns {Promise<boolean>}
 */
const canManageQuiz = async (userId, quiz) => {
  if (!userId || !quiz) return false
  if (!quiz.community) return quiz.user.toString() === userId.toString()

  const role = await getMemberRole(userId, quiz.community)
  return canModerate(role)
}

module.exports = { canAccessQuiz, canManageQuiz }
