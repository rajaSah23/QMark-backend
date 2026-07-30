"use strict"

const request = require("supertest")
const mongoose = require("mongoose")
const app = require("../app")
const { createUser, createQuestion, authHeader } = require("./helpers/factories")

const answer = (token, questionId, selectedAnswer) =>
  request(app)
    .post(`/api/v1/mcq/${questionId}/option-click`)
    .set(authHeader(token))
    .send({ selectedAnswer })

describe("POST /quiz with filters.adaptive", () => {
  it("still behaves like plain random selection when adaptive is omitted", async () => {
    const { user, token } = await createUser()
    for (let i = 0; i < 5; i++) {
      await createQuestion(user._id, { question: `Q${i}?` })
    }

    const res = await request(app)
      .post("/api/v1/quiz")
      .set(authHeader(token))
      .send({ title: "Plain Quiz", filters: { limit: 3 } })

    expect(res.status).toBe(201)
    expect(res.body.data.questions).toHaveLength(3)
  })

  it("pulls more questions from the subject the user is weaker in", async () => {
    const { user, token } = await createUser()
    const physics = new mongoose.Types.ObjectId()
    const chemistry = new mongoose.Types.ObjectId()

    const physicsQuestions = []
    for (let i = 0; i < 10; i++) {
      physicsQuestions.push(
        await createQuestion(user._id, {
          question: `Physics ${i}?`,
          subject: physics,
          difficulty: "medium",
          correctAnswer: "4"
        })
      )
    }
    const chemistryQuestions = []
    for (let i = 0; i < 10; i++) {
      chemistryQuestions.push(
        await createQuestion(user._id, {
          question: `Chemistry ${i}?`,
          subject: chemistry,
          difficulty: "medium",
          correctAnswer: "4"
        })
      )
    }

    // Build a real accuracy history: 1/5 correct in physics (weak),
    // 5/5 correct in chemistry (strong).
    for (let i = 0; i < 5; i++) {
      await answer(token, physicsQuestions[i]._id.toString(), i === 0 ? "4" : "3")
    }
    for (let i = 0; i < 5; i++) {
      await answer(token, chemistryQuestions[i]._id.toString(), "4")
    }

    const res = await request(app)
      .post("/api/v1/quiz")
      .set(authHeader(token))
      .send({ title: "Adaptive Quiz", filters: { limit: 10, adaptive: true } })

    expect(res.status).toBe(201)
    const selectedIds = res.body.data.questions.map((q) => q.toString())
    const physicsCount = physicsQuestions.filter((q) =>
      selectedIds.includes(q._id.toString())
    ).length
    const chemistryCount = chemistryQuestions.filter((q) =>
      selectedIds.includes(q._id.toString())
    ).length

    expect(selectedIds).toHaveLength(10)
    expect(physicsCount).toBeGreaterThan(chemistryCount)
  })

  it("respects an explicit difficulty filter even in adaptive mode", async () => {
    const { user, token } = await createUser()
    for (let i = 0; i < 5; i++) {
      await createQuestion(user._id, { question: `Easy ${i}?`, difficulty: "easy" })
    }
    for (let i = 0; i < 5; i++) {
      await createQuestion(user._id, { question: `Hard ${i}?`, difficulty: "hard" })
    }

    const res = await request(app)
      .post("/api/v1/quiz")
      .set(authHeader(token))
      .send({
        title: "Adaptive Easy Only",
        filters: { limit: 5, adaptive: true, difficulty: "easy" }
      })

    expect(res.status).toBe(201)
    // Fetch the created quiz with questions populated to check their difficulty.
    const quizId = res.body.data._id
    const detail = await request(app)
      .get(`/api/v1/quiz/${quizId}`)
      .set(authHeader(token))

    expect(detail.body.data.questions).toHaveLength(5)
    expect(detail.body.data.questions.every((q) => q.difficulty === "easy")).toBe(true)
  })

  it("does not apply adaptive selection to a community quiz's auto-pick", async () => {
    const admin = await createUser()
    const communityRes = await request(app)
      .post("/api/v1/community")
      .set(authHeader(admin.token))
      .send({ name: "Adaptive Test Group" })
    const communityId = communityRes.body.data._id

    const questions = []
    for (let i = 0; i < 5; i++) {
      const q = await createQuestion(admin.user._id, { question: `Shared ${i}?` })
      await request(app)
        .post(`/api/v1/community/${communityId}/questions`)
        .set(authHeader(admin.token))
        .send({ questionId: q._id.toString() })
      questions.push(q)
    }

    // adaptive:true is silently irrelevant here — no crash, no special
    // treatment, community auto-pick stays a plain random sample.
    const res = await request(app)
      .post("/api/v1/quiz")
      .set(authHeader(admin.token))
      .send({
        title: "Community Quiz",
        communityId,
        filters: { limit: 3, adaptive: true }
      })

    expect(res.status).toBe(201)
    expect(res.body.data.questions).toHaveLength(3)
    expect(res.body.data.community).toBe(communityId)
  })

  it("treats a subject with no answer history as neutral, not maximal weight", async () => {
    const { user, token } = await createUser()
    const knownWeak = new mongoose.Types.ObjectId()
    const neverAttempted = new mongoose.Types.ObjectId()

    const weakQuestions = []
    for (let i = 0; i < 10; i++) {
      weakQuestions.push(
        await createQuestion(user._id, {
          question: `Weak ${i}?`,
          subject: knownWeak,
          difficulty: "medium",
          correctAnswer: "4"
        })
      )
    }
    const freshQuestions = []
    for (let i = 0; i < 10; i++) {
      freshQuestions.push(
        await createQuestion(user._id, {
          question: `Fresh ${i}?`,
          subject: neverAttempted,
          difficulty: "medium"
        })
      )
    }

    // 0/5 correct — a demonstrated, severe weakness.
    for (let i = 0; i < 5; i++) {
      await answer(token, weakQuestions[i]._id.toString(), "3")
    }

    const res = await request(app)
      .post("/api/v1/quiz")
      .set(authHeader(token))
      .send({ title: "Neutral Test", filters: { limit: 10, adaptive: true } })

    const selectedIds = res.body.data.questions.map((q) => q.toString())
    const weakCount = weakQuestions.filter((q) => selectedIds.includes(q._id.toString()))
      .length
    const freshCount = freshQuestions.filter((q) => selectedIds.includes(q._id.toString()))
      .length

    // The demonstrated 0%-accuracy subject must outweigh the untouched one.
    expect(weakCount).toBeGreaterThan(freshCount)
  })
})
