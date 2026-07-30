"use strict"

/**
 * Picks `limit` questions out of `pool`, biased two ways at once:
 *
 *  1. SUBJECT: subjects where the user's accuracy is lower get proportionally
 *     more of the `limit` slots (weak areas get more practice).
 *  2. DIFFICULTY: within each subject's allocation, the easy/medium/hard mix
 *     shifts by the user's accuracy IN THAT SUBJECT — struggling nudges
 *     toward easier questions, doing well nudges toward harder ones.
 *     Skipped (not adapted) when `forcedDifficulty` is set: the caller
 *     explicitly locked difficulty, so only that difficulty is eligible.
 *
 * Pure and DB-free by design — the caller does all fetching; this module
 * only decides which of the given candidates to use.
 *
 * @param {object} args
 * @param {{_id: any, subject: any, difficulty: "easy"|"medium"|"hard"}[]} args.pool
 * @param {Record<string, number|null|undefined>} args.subjectAccuracy -
 *   subjectId (string) -> accuracy 0..1. Missing/null means "no history for
 *   this subject yet", treated as NEUTRAL_ACCURACY, not as "weakest".
 * @param {number} args.limit
 * @param {"easy"|"medium"|"hard"|null} [args.forcedDifficulty]
 * @returns {any[]} selected question ids, length <= limit (fewer only if the
 *   pool itself doesn't have enough questions).
 */

// No history yet: treated as moderately-known rather than "weakest subject",
// so a brand-new subject doesn't crowd out subjects with a demonstrated,
// measured weakness.
const NEUTRAL_ACCURACY = 0.6
// Even a subject at 100% accuracy still gets occasional practice.
const MIN_SUBJECT_WEIGHT = 0.15

const resolveAccuracy = (accuracy) =>
  accuracy === undefined || accuracy === null ? NEUTRAL_ACCURACY : accuracy

const subjectWeight = (accuracy) =>
  Math.max(MIN_SUBJECT_WEIGHT, 1 - resolveAccuracy(accuracy))

const difficultyMix = (accuracy) => {
  const a = resolveAccuracy(accuracy)
  if (a < 0.5) return { easy: 0.5, medium: 0.35, hard: 0.15 }
  if (a < 0.75) return { easy: 0.3, medium: 0.4, hard: 0.3 }
  return { easy: 0.15, medium: 0.35, hard: 0.5 }
}

const shuffle = (list) =>
  list
    .map((item) => [Math.random(), item])
    .sort((a, b) => a[0] - b[0])
    .map(([, item]) => item)

/** Largest-remainder apportionment: whole-number allocations that sum to exactly `total`. */
const apportion = (weights, total) => {
  const sumWeights = weights.reduce((a, b) => a + b, 0)
  if (sumWeights === 0 || total === 0) return weights.map(() => 0)

  const raw = weights.map((w) => (w / sumWeights) * total)
  const allocations = raw.map(Math.floor)
  let remaining = total - allocations.reduce((a, b) => a + b, 0)

  const byRemainder = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)

  for (let i = 0; i < remaining; i++) {
    allocations[byRemainder[i % byRemainder.length].index] += 1
  }
  return allocations
}

const selectAdaptiveQuestions = ({
  pool,
  subjectAccuracy = {},
  limit,
  forcedDifficulty = null
}) => {
  if (!pool || pool.length === 0 || limit <= 0) return []

  const bySubject = new Map()
  for (const item of pool) {
    const key = item.subject ? item.subject.toString() : "unassigned"
    if (!bySubject.has(key)) bySubject.set(key, [])
    bySubject.get(key).push(item)
  }

  const subjectKeys = [...bySubject.keys()]
  const weights = subjectKeys.map((key) => subjectWeight(subjectAccuracy[key]))
  const allocations = apportion(weights, limit)

  const selected = []
  const leftover = []

  subjectKeys.forEach((key, index) => {
    const candidates = bySubject.get(key)
    const want = allocations[index]
    if (want === 0) {
      leftover.push(...candidates)
      return
    }

    let picked
    if (forcedDifficulty) {
      picked = shuffle(candidates.filter((c) => c.difficulty === forcedDifficulty)).slice(
        0,
        want
      )
    } else {
      const mix = difficultyMix(subjectAccuracy[key])
      const byDifficulty = { easy: [], medium: [], hard: [] }
      for (const candidate of candidates) {
        if (byDifficulty[candidate.difficulty]) byDifficulty[candidate.difficulty].push(candidate)
      }

      picked = []
      for (const level of ["easy", "medium", "hard"]) {
        const wantAtLevel = Math.round(want * mix[level])
        picked.push(...shuffle(byDifficulty[level]).slice(0, wantAtLevel))
      }

      // Rounding the three difficulty buckets rarely lands exactly on `want`.
      // Top up or trim using the rest of this subject's pool, regardless of
      // difficulty, so the subject's own allocation is still met precisely
      // when the subject has enough questions overall.
      if (picked.length < want) {
        const pickedIds = new Set(picked.map((p) => p._id.toString()))
        const rest = shuffle(candidates.filter((c) => !pickedIds.has(c._id.toString())))
        picked.push(...rest.slice(0, want - picked.length))
      } else if (picked.length > want) {
        picked = shuffle(picked).slice(0, want)
      }
    }

    selected.push(...picked)
    const pickedIds = new Set(picked.map((p) => p._id.toString()))
    leftover.push(...candidates.filter((c) => !pickedIds.has(c._id.toString())))
  })

  // A thin subject/difficulty combination can leave the total short of
  // `limit` (e.g. too few "hard" questions exist yet) — backfill from
  // whatever's left across all subjects rather than under-filling the quiz.
  if (selected.length < limit) {
    const selectedIds = new Set(selected.map((s) => s._id.toString()))
    const backfill = shuffle(leftover.filter((c) => !selectedIds.has(c._id.toString())))
    selected.push(...backfill.slice(0, limit - selected.length))
  }

  return shuffle(selected)
    .slice(0, limit)
    .map((c) => c._id)
}

module.exports = {
  selectAdaptiveQuestions,
  subjectWeight,
  difficultyMix,
  NEUTRAL_ACCURACY,
  MIN_SUBJECT_WEIGHT
}
