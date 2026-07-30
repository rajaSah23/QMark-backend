"use strict"

const { schedule, MIN_EASE_FACTOR, INITIAL_EASE_FACTOR } = require("../modules/mcq/srs")

describe("SM-2 spaced-repetition scheduler", () => {
  const freshState = { easeFactor: 0, interval: 0, repetitions: 0 }
  const now = new Date("2026-01-01T00:00:00.000Z")

  it("schedules a first correct answer for 1 day out", () => {
    const result = schedule(freshState, true, now)

    expect(result.repetitions).toBe(1)
    expect(result.interval).toBe(1)
    expect(result.easeFactor).toBeCloseTo(INITIAL_EASE_FACTOR + 0.1)
    expect(result.nextReviewAt.toISOString()).toBe("2026-01-02T00:00:00.000Z")
  })

  it("schedules a second consecutive correct answer for 6 days out", () => {
    const first = schedule(freshState, true, now)
    const second = schedule(first, true, first.nextReviewAt)

    expect(second.repetitions).toBe(2)
    expect(second.interval).toBe(6)
  })

  it("grows the interval by the ease factor from the third correct answer on", () => {
    const first = schedule(freshState, true, now)
    const second = schedule(first, true, first.nextReviewAt)
    const third = schedule(second, true, second.nextReviewAt)

    // SM-2 computes the new ease factor FIRST, then multiplies the prior
    // interval by that updated value — not the pre-update one.
    expect(third.repetitions).toBe(3)
    expect(third.interval).toBe(Math.round(6 * third.easeFactor))
  })

  it("resets repetitions and interval to 1 day on an incorrect answer", () => {
    const first = schedule(freshState, true, now)
    const second = schedule(first, true, first.nextReviewAt)
    const wrong = schedule(second, false, second.nextReviewAt)

    expect(wrong.repetitions).toBe(0)
    expect(wrong.interval).toBe(1)
  })

  it("lowers the ease factor on an incorrect answer but never below 1.3", () => {
    const result = schedule(freshState, false, now)
    expect(result.easeFactor).toBeCloseTo(INITIAL_EASE_FACTOR - 0.8)

    // Repeated wrong answers should floor out, not go negative or keep falling.
    let state = freshState
    for (let i = 0; i < 10; i++) {
      state = schedule(state, false, now)
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(MIN_EASE_FACTOR)
    expect(state.easeFactor).toBeCloseTo(MIN_EASE_FACTOR)
  })

  it("raises the ease factor a little further on each correct answer, unbounded upward", () => {
    let state = freshState
    for (let i = 0; i < 5; i++) {
      state = schedule(state, true, now)
    }
    expect(state.easeFactor).toBeCloseTo(INITIAL_EASE_FACTOR + 0.5)
  })

  it("is a pure function — does not mutate the state object passed in", () => {
    const input = { easeFactor: 2.5, interval: 6, repetitions: 2 }
    const snapshot = { ...input }

    schedule(input, true, now)

    expect(input).toEqual(snapshot)
  })

  it("treats a missing/null prior state as brand new", () => {
    const result = schedule(null, true, now)
    expect(result.repetitions).toBe(1)
    expect(result.interval).toBe(1)
    expect(result.easeFactor).toBeCloseTo(INITIAL_EASE_FACTOR + 0.1)
  })
})
