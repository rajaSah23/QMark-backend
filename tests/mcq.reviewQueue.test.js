"use strict"

const request = require("supertest")
const app = require("../app")
const UserQuestionState = require("../modules/mcq/userQuestionStateModel")
const { createUser, createQuestion, authHeader } = require("./helpers/factories")

const answer = (token, questionId, selectedAnswer) =>
  request(app)
    .post(`/api/v1/mcq/${questionId}/option-click`)
    .set(authHeader(token))
    .send({ selectedAnswer })

/** Backdates a question's nextReviewAt so it reads as already due, without
 *  waiting on real time or reimplementing the scheduler in the test. */
const backdateReview = (userId, questionId, daysAgo) =>
  UserQuestionState.updateOne(
    { user: userId, question: questionId },
    { $set: { nextReviewAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) } }
  )

describe("answering a question schedules spaced repetition", () => {
  it("creates a UserQuestionState row on first answer, due tomorrow", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id, { correctAnswer: "4" })

    await answer(token, question._id.toString(), "4")

    const state = await UserQuestionState.findOne({ user: user._id, question: question._id })
    expect(state).not.toBeNull()
    expect(state.repetitions).toBe(1)
    expect(state.interval).toBe(1)
    expect(state.nextReviewAt).not.toBeNull()
  })

  it("does not clobber an existing bookmark when scheduling review state", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id, { correctAnswer: "4" })

    await request(app)
      .patch("/api/v1/mcq")
      .set(authHeader(token))
      .send({ questionId: question._id.toString(), bookmark: true })

    await answer(token, question._id.toString(), "4")

    const state = await UserQuestionState.findOne({ user: user._id, question: question._id })
    expect(state.bookmarked).toBe(true)
    expect(state.repetitions).toBe(1)
  })

  it("resets the schedule on a wrong answer", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id, {
      correctAnswer: "4",
      options: ["3", "4", "5", "6"]
    })

    await answer(token, question._id.toString(), "4") // correct: rep 1
    await backdateReview(user._id, question._id, 1) // make it due
    await answer(token, question._id.toString(), "3") // wrong: resets

    const state = await UserQuestionState.findOne({ user: user._id, question: question._id })
    expect(state.repetitions).toBe(0)
    expect(state.interval).toBe(1)
  })

  it("advances the schedule on repeated correct answers", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id, { correctAnswer: "4" })

    await answer(token, question._id.toString(), "4")
    await backdateReview(user._id, question._id, 1)
    await answer(token, question._id.toString(), "4")

    const state = await UserQuestionState.findOne({ user: user._id, question: question._id })
    expect(state.repetitions).toBe(2)
    expect(state.interval).toBe(6)
  })
})

describe("GET /mcq/review-queue", () => {
  it("excludes a question not yet due", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id, { correctAnswer: "4" })
    await answer(token, question._id.toString(), "4") // due tomorrow, not today

    const res = await request(app).get("/api/v1/mcq/review-queue").set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.results).toHaveLength(0)
  })

  it("includes a question once its due date has passed", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id, { correctAnswer: "4" })
    await answer(token, question._id.toString(), "4")
    await backdateReview(user._id, question._id, 1)

    const res = await request(app).get("/api/v1/mcq/review-queue").set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.results).toHaveLength(1)
    expect(res.body.data.results[0]._id).toBe(question._id.toString())
    expect(res.body.data.results[0].srs.repetitions).toBe(1)
  })

  it("excludes a question the user has never answered", async () => {
    const { user, token } = await createUser()
    await createQuestion(user._id) // never answered, never scheduled

    const res = await request(app).get("/api/v1/mcq/review-queue").set(authHeader(token))

    expect(res.body.data.results).toHaveLength(0)
  })

  it("sorts soonest-overdue first", async () => {
    const { user, token } = await createUser()
    const older = await createQuestion(user._id, { question: "Older?", correctAnswer: "4" })
    const newer = await createQuestion(user._id, { question: "Newer?", correctAnswer: "4" })

    await answer(token, older._id.toString(), "4")
    await answer(token, newer._id.toString(), "4")
    await backdateReview(user._id, older._id, 5)
    await backdateReview(user._id, newer._id, 1)

    const res = await request(app).get("/api/v1/mcq/review-queue").set(authHeader(token))

    expect(res.body.data.results).toHaveLength(2)
    expect(res.body.data.results[0].question).toBe("Older?")
    expect(res.body.data.results[1].question).toBe("Newer?")
  })

  it("does not surface another user's due questions", async () => {
    const userA = await createUser()
    const userB = await createUser()
    const question = await createQuestion(userA.user._id, { correctAnswer: "4" })
    await answer(userA.token, question._id.toString(), "4")
    await backdateReview(userA.user._id, question._id, 1)

    const res = await request(app)
      .get("/api/v1/mcq/review-queue")
      .set(authHeader(userB.token))

    expect(res.body.data.results).toHaveLength(0)
  })

  it("stops surfacing a shared question once access is revoked", async () => {
    const owner = await createUser()
    const member = await createUser()

    const communityRes = await request(app)
      .post("/api/v1/community")
      .set(authHeader(owner.token))
      .send({ name: "Review Queue Group" })
    const communityId = communityRes.body.data._id

    await request(app)
      .post(`/api/v1/community/${communityId}/join`)
      .set(authHeader(member.token))

    const question = await createQuestion(owner.user._id, { correctAnswer: "4" })
    await request(app)
      .post(`/api/v1/community/${communityId}/questions`)
      .set(authHeader(owner.token))
      .send({ questionId: question._id.toString() })

    await answer(member.token, question._id.toString(), "4")
    await backdateReview(member.user._id, question._id, 1)

    const before = await request(app)
      .get("/api/v1/mcq/review-queue")
      .set(authHeader(member.token))
    expect(before.body.data.results).toHaveLength(1)

    await request(app)
      .delete(`/api/v1/community/${communityId}/questions/${question._id}`)
      .set(authHeader(owner.token))

    const after = await request(app)
      .get("/api/v1/mcq/review-queue")
      .set(authHeader(member.token))
    expect(after.body.data.results).toHaveLength(0)
  })

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/mcq/review-queue")
    expect(res.status).toBe(401)
  })
})
