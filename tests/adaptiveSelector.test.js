"use strict"

const {
  selectAdaptiveQuestions,
  subjectWeight,
  difficultyMix,
  NEUTRAL_ACCURACY,
  MIN_SUBJECT_WEIGHT
} = require("../modules/quiz/adaptiveSelector")

/** Builds N fake questions for a subject at a given difficulty, with unique ids. */
const makeQuestions = (subject, difficulty, count, prefix) =>
  Array.from({ length: count }, (_, i) => ({
    _id: `${prefix}-${difficulty}-${i}`,
    subject,
    difficulty
  }))

describe("subjectWeight", () => {
  it("weights a weak subject (low accuracy) higher than a strong one", () => {
    expect(subjectWeight(0.2)).toBeGreaterThan(subjectWeight(0.9))
  })

  it("treats missing history as neutral, not as the weakest subject", () => {
    const neutralWeight = subjectWeight(undefined)
    const weakWeight = subjectWeight(0.1)
    const strongWeight = subjectWeight(0.95)

    expect(neutralWeight).toBe(1 - NEUTRAL_ACCURACY)
    expect(weakWeight).toBeGreaterThan(neutralWeight)
    expect(neutralWeight).toBeGreaterThan(strongWeight)
  })

  it("floors at MIN_SUBJECT_WEIGHT even at 100% accuracy", () => {
    expect(subjectWeight(1)).toBe(MIN_SUBJECT_WEIGHT)
  })
})

describe("difficultyMix", () => {
  it("favors easy questions when accuracy is low", () => {
    const mix = difficultyMix(0.2)
    expect(mix.easy).toBeGreaterThan(mix.hard)
  })

  it("favors hard questions when accuracy is high", () => {
    const mix = difficultyMix(0.9)
    expect(mix.hard).toBeGreaterThan(mix.easy)
  })

  it("always sums to 1", () => {
    for (const accuracy of [0, 0.3, 0.6, 0.9, 1]) {
      const mix = difficultyMix(accuracy)
      expect(mix.easy + mix.medium + mix.hard).toBeCloseTo(1)
    }
  })
})

describe("selectAdaptiveQuestions — subject weighting", () => {
  it("pulls more questions from a weak subject than a strong one", () => {
    const pool = [
      ...makeQuestions("physics", "medium", 20, "phy"),
      ...makeQuestions("chemistry", "medium", 20, "chem")
    ]
    const subjectAccuracy = { physics: 0.2, chemistry: 0.95 }

    const selected = selectAdaptiveQuestions({ pool, subjectAccuracy, limit: 20 })
    const physicsCount = selected.filter((id) => id.startsWith("phy")).length
    const chemistryCount = selected.filter((id) => id.startsWith("chem")).length

    expect(physicsCount).toBeGreaterThan(chemistryCount)
    expect(physicsCount + chemistryCount).toBe(20)
  })

  it("still includes a few questions from a subject the user has mastered", () => {
    const pool = [
      ...makeQuestions("physics", "medium", 20, "phy"),
      ...makeQuestions("chemistry", "medium", 20, "chem")
    ]
    const subjectAccuracy = { physics: 0.1, chemistry: 1.0 }

    const selected = selectAdaptiveQuestions({ pool, subjectAccuracy, limit: 20 })
    const chemistryCount = selected.filter((id) => id.startsWith("chem")).length

    expect(chemistryCount).toBeGreaterThan(0)
  })

  it("gives an unattempted subject a fair (neutral), not maximal, share", () => {
    const pool = [
      ...makeQuestions("physics", "medium", 20, "phy"), // weak, attempted
      ...makeQuestions("biology", "medium", 20, "bio") // never attempted
    ]
    const subjectAccuracy = { physics: 0.1 } // biology has no entry at all

    const selected = selectAdaptiveQuestions({ pool, subjectAccuracy, limit: 20 })
    const physicsCount = selected.filter((id) => id.startsWith("phy")).length
    const biologyCount = selected.filter((id) => id.startsWith("bio")).length

    // Demonstrated weakness (physics, 10% accuracy) outweighs an unknown
    // subject (biology) — biology is treated as moderately-known, not "weakest".
    expect(physicsCount).toBeGreaterThan(biologyCount)
    expect(physicsCount + biologyCount).toBe(20)
  })
})

describe("selectAdaptiveQuestions — difficulty adaptation", () => {
  it("skews toward easy/medium questions for a subject the user struggles with", () => {
    const pool = [
      ...makeQuestions("physics", "easy", 20, "e"),
      ...makeQuestions("physics", "medium", 20, "m"),
      ...makeQuestions("physics", "hard", 20, "h")
    ]
    const subjectAccuracy = { physics: 0.2 }

    const selected = selectAdaptiveQuestions({ pool, subjectAccuracy, limit: 20 })
    const easyCount = selected.filter((id) => id.startsWith("e-")).length
    const hardCount = selected.filter((id) => id.startsWith("h-")).length

    expect(easyCount).toBeGreaterThan(hardCount)
  })

  it("skews toward hard questions for a subject the user has mastered", () => {
    const pool = [
      ...makeQuestions("physics", "easy", 20, "e"),
      ...makeQuestions("physics", "medium", 20, "m"),
      ...makeQuestions("physics", "hard", 20, "h")
    ]
    const subjectAccuracy = { physics: 0.95 }

    const selected = selectAdaptiveQuestions({ pool, subjectAccuracy, limit: 20 })
    const easyCount = selected.filter((id) => id.startsWith("e-")).length
    const hardCount = selected.filter((id) => id.startsWith("h-")).length

    expect(hardCount).toBeGreaterThan(easyCount)
  })

  it("respects forcedDifficulty by only selecting that difficulty, ignoring accuracy-based mix", () => {
    const pool = [
      ...makeQuestions("physics", "easy", 20, "e"),
      ...makeQuestions("physics", "medium", 20, "m"),
      ...makeQuestions("physics", "hard", 20, "h")
    ]
    // Even with high accuracy (which would normally favor hard), a forced
    // difficulty of "easy" must return only easy questions.
    const selected = selectAdaptiveQuestions({
      pool,
      subjectAccuracy: { physics: 0.95 },
      limit: 10,
      forcedDifficulty: "easy"
    })

    expect(selected).toHaveLength(10)
    expect(selected.every((id) => id.startsWith("e-"))).toBe(true)
  })
})

describe("selectAdaptiveQuestions — edge cases", () => {
  it("returns an empty array for an empty pool", () => {
    expect(selectAdaptiveQuestions({ pool: [], subjectAccuracy: {}, limit: 10 })).toEqual([])
  })

  it("returns fewer than limit when the pool itself is smaller than limit", () => {
    const pool = makeQuestions("physics", "medium", 3, "phy")
    const selected = selectAdaptiveQuestions({ pool, subjectAccuracy: {}, limit: 10 })
    expect(selected).toHaveLength(3)
  })

  it("backfills from other subjects when one subject/difficulty combo runs thin", () => {
    // physics has only 2 hard questions but is weighted to want more than that;
    // the shortfall must be made up from chemistry rather than under-filling.
    const pool = [
      ...makeQuestions("physics", "hard", 2, "phy-h"),
      ...makeQuestions("chemistry", "medium", 20, "chem")
    ]
    const subjectAccuracy = { physics: 0.95, chemistry: 0.5 }

    const selected = selectAdaptiveQuestions({ pool, subjectAccuracy, limit: 10 })
    expect(selected).toHaveLength(10)
  })

  it("never returns duplicate question ids", () => {
    const pool = [
      ...makeQuestions("physics", "easy", 10, "e"),
      ...makeQuestions("physics", "medium", 10, "m"),
      ...makeQuestions("physics", "hard", 10, "h")
    ]
    const selected = selectAdaptiveQuestions({
      pool,
      subjectAccuracy: { physics: 0.5 },
      limit: 15
    })
    expect(new Set(selected).size).toBe(selected.length)
  })

  it("treats questions with no subject as their own 'unassigned' bucket", () => {
    const pool = [
      ...makeQuestions(null, "medium", 5, "none"),
      ...makeQuestions("physics", "medium", 5, "phy")
    ]
    const selected = selectAdaptiveQuestions({ pool, subjectAccuracy: {}, limit: 10 })
    expect(selected).toHaveLength(10)
  })

  it("is a pure function — does not mutate the input pool", () => {
    const pool = makeQuestions("physics", "medium", 5, "phy")
    const snapshot = JSON.parse(JSON.stringify(pool))

    selectAdaptiveQuestions({ pool, subjectAccuracy: {}, limit: 3 })

    expect(pool).toEqual(snapshot)
  })
})
