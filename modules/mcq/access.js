"use strict"

/**
 * Decides whether a user may READ or ANSWER a question.
 *
 * This is the single seam through which question visibility flows. Today the
 * only rule is authorship, which makes it behaviourally identical to the
 * inline owner checks it replaces. When communities land, the community
 * membership rule is added HERE and every read path inherits it.
 *
 * Note this governs read/answer/bookmark only. Editing and deleting a
 * question stay author-only and are checked with canModifyQuestion.
 *
 * @param {string} userId
 * @param {{ user: any }} question - an MCQ document or lean object
 * @returns {boolean}
 */
const canAccessQuestion = (userId, question) => {
  if (!userId || !question || !question.user) return false
  return question.user.toString() === userId.toString()
}

/**
 * True when the user may modify (edit/delete) the question. Author-only, and
 * intentionally NOT widened by community membership.
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
