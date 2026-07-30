"use strict"

/**
 * SM-2 spaced-repetition scheduler, adapted for a binary correct/incorrect
 * signal (QMark only ever knows "right" or "wrong" from an answer click —
 * there's no 0-5 self-rating step). This maps directly onto the classic SM-2
 * quality scale by treating a correct answer as quality=5 (perfect recall)
 * and an incorrect one as quality=0 (complete blackout), then applying the
 * standard SM-2 formulas unmodified:
 *
 *   EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
 *   q=5 -> EF + 0.1
 *   q=0 -> EF - 0.8
 *
 * Interval growth: 1st correct rep -> 1 day, 2nd -> 6 days, thereafter
 * interval * easeFactor. Any incorrect answer resets repetitions and interval
 * to start over at 1 day, without punishing easeFactor into a spiral below
 * the standard 1.3 floor.
 *
 * Reference: Piotr Wozniak, "SuperMemo 2 algorithm" (1987).
 */

const MIN_EASE_FACTOR = 1.3
const INITIAL_EASE_FACTOR = 2.5

/**
 * @param {{ easeFactor: number, interval: number, repetitions: number }} state
 *   Current scheduling state. Pass zeros/defaults for a question never
 *   reviewed before.
 * @param {boolean} isCorrect
 * @param {Date} [now] - injectable for tests; defaults to the real clock.
 * @returns {{ easeFactor: number, interval: number, repetitions: number, nextReviewAt: Date }}
 */
const schedule = (state, isCorrect, now = new Date()) => {
  const easeFactor = state?.easeFactor || INITIAL_EASE_FACTOR
  const repetitions = state?.repetitions || 0

  let nextEaseFactor
  let nextRepetitions
  let nextInterval

  if (isCorrect) {
    nextEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor + 0.1)
    nextRepetitions = repetitions + 1

    if (nextRepetitions === 1) nextInterval = 1
    else if (nextRepetitions === 2) nextInterval = 6
    else nextInterval = Math.round((state?.interval || 1) * nextEaseFactor)
  } else {
    nextEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.8)
    nextRepetitions = 0
    nextInterval = 1
  }

  const nextReviewAt = new Date(now)
  nextReviewAt.setDate(nextReviewAt.getDate() + nextInterval)

  return {
    easeFactor: nextEaseFactor,
    interval: nextInterval,
    repetitions: nextRepetitions,
    nextReviewAt
  }
}

module.exports = { schedule, MIN_EASE_FACTOR, INITIAL_EASE_FACTOR }
