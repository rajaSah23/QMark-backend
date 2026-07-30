"use strict"

const request = require("supertest")
const app = require("../app")
const { createUser, createQuestion, authHeader } = require("./helpers/factories")

const createExamQuiz = async (token, questionId, overrides = {}) => {
  const res = await request(app)
    .post("/api/v1/quiz")
    .set(authHeader(token))
    .send({
      title: "Mock Exam",
      examMode: true,
      questionIds: [questionId],
      ...overrides
    })
  expect(res.status).toBe(201)
  return res.body.data
}

describe("creating a quiz with examMode", () => {
  it("persists examMode:true on the quiz", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id)

    const quiz = await createExamQuiz(token, question._id.toString())

    expect(quiz.examMode).toBe(true)
  })

  it("ignores examMode on a community quiz — community alone already makes it exam-style", async () => {
    const admin = await createUser()
    const communityRes = await request(app)
      .post("/api/v1/community")
      .set(authHeader(admin.token))
      .send({ name: "Exam Mode Group" })
    const communityId = communityRes.body.data._id

    const question = await createQuestion(admin.user._id)
    await request(app)
      .post(`/api/v1/community/${communityId}/questions`)
      .set(authHeader(admin.token))
      .send({ questionId: question._id.toString() })

    const res = await request(app)
      .post("/api/v1/quiz")
      .set(authHeader(admin.token))
      .send({
        title: "Community Exam",
        communityId,
        examMode: true,
        questionIds: [question._id.toString()]
      })

    expect(res.status).toBe(201)
    // Stored as false: community-ness alone drives exam-style behaviour,
    // the flag itself is meaningless there.
    expect(res.body.data.examMode).toBe(false)
    expect(res.body.data.community).toBe(communityId)
  })
})

describe("attempting an examMode personal quiz", () => {
  it("allows exactly one attempt, blocking a second", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id, { correctAnswer: "4" })
    const quiz = await createExamQuiz(token, question._id.toString())

    const first = await request(app)
      .post(`/api/v1/quiz/${quiz._id}/attempt`)
      .set(authHeader(token))
      .send({ answers: [{ question: question._id.toString(), selectedAnswer: "4" }] })
    expect(first.status).toBe(201)

    const second = await request(app)
      .post(`/api/v1/quiz/${quiz._id}/attempt`)
      .set(authHeader(token))
      .send({ answers: [{ question: question._id.toString(), selectedAnswer: "4" }] })
    expect(second.status).toBe(400)
  })

  it("rejects a submission that reports exceeding the time limit", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id, { correctAnswer: "4" })
    const quiz = await createExamQuiz(token, question._id.toString(), {
      settings: { timeLimit: 1 } // 1 minute = 60s, +15s grace = 75s cutoff
    })

    const res = await request(app)
      .post(`/api/v1/quiz/${quiz._id}/attempt`)
      .set(authHeader(token))
      .send({
        answers: [{ question: question._id.toString(), selectedAnswer: "4" }],
        timeTaken: 90
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/time limit/i)
  })

  it("accepts a submission within the time limit's grace window", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id, { correctAnswer: "4" })
    const quiz = await createExamQuiz(token, question._id.toString(), {
      settings: { timeLimit: 1 }
    })

    const res = await request(app)
      .post(`/api/v1/quiz/${quiz._id}/attempt`)
      .set(authHeader(token))
      .send({
        answers: [{ question: question._id.toString(), selectedAnswer: "4" }],
        timeTaken: 70 // over the raw 60s limit, within the 15s grace
      })

    expect(res.status).toBe(201)
  })

  it("does not enforce a time cutoff when timeLimit is 0 (no limit)", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id, { correctAnswer: "4" })
    const quiz = await createExamQuiz(token, question._id.toString(), {
      settings: { timeLimit: 0 }
    })

    const res = await request(app)
      .post(`/api/v1/quiz/${quiz._id}/attempt`)
      .set(authHeader(token))
      .send({
        answers: [{ question: question._id.toString(), selectedAnswer: "4" }],
        timeTaken: 999999
      })

    expect(res.status).toBe(201)
  })
})

describe("plain personal quizzes are unaffected", () => {
  it("still allows unlimited attempts when examMode is false", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id, { correctAnswer: "4" })

    const created = await request(app)
      .post("/api/v1/quiz")
      .set(authHeader(token))
      .send({ title: "Practice Quiz", questionIds: [question._id.toString()] })
    const quiz = created.body.data

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post(`/api/v1/quiz/${quiz._id}/attempt`)
        .set(authHeader(token))
        .send({ answers: [{ question: question._id.toString(), selectedAnswer: "4" }] })
      expect(res.status).toBe(201)
    }
  })

  it("still ignores timeLimit as a hard cutoff when examMode is false", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id, { correctAnswer: "4" })

    const created = await request(app)
      .post("/api/v1/quiz")
      .set(authHeader(token))
      .send({
        title: "Untimed-enforcement Practice Quiz",
        questionIds: [question._id.toString()],
        settings: { timeLimit: 1 }
      })

    const res = await request(app)
      .post(`/api/v1/quiz/${created.body.data._id}/attempt`)
      .set(authHeader(token))
      .send({
        answers: [{ question: question._id.toString(), selectedAnswer: "4" }],
        timeTaken: 99999
      })

    expect(res.status).toBe(201)
  })
})

describe("GET /quiz/:quizId reports attempt status for exam-style quizzes", () => {
  it("reports hasAttempted:false before attempting, true after", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id, { correctAnswer: "4" })
    const quiz = await createExamQuiz(token, question._id.toString())

    const before = await request(app)
      .get(`/api/v1/quiz/${quiz._id}`)
      .set(authHeader(token))
    expect(before.body.data.hasAttempted).toBe(false)
    expect(before.body.data.attemptId).toBeNull()

    const attempt = await request(app)
      .post(`/api/v1/quiz/${quiz._id}/attempt`)
      .set(authHeader(token))
      .send({ answers: [{ question: question._id.toString(), selectedAnswer: "4" }] })

    const after = await request(app)
      .get(`/api/v1/quiz/${quiz._id}`)
      .set(authHeader(token))
    expect(after.body.data.hasAttempted).toBe(true)
    expect(after.body.data.attemptId).toBe(attempt.body.data.attemptId)
  })

  it("omits hasAttempted for a plain (non-exam) personal quiz", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id)

    const created = await request(app)
      .post("/api/v1/quiz")
      .set(authHeader(token))
      .send({ title: "Plain Quiz", questionIds: [question._id.toString()] })

    const res = await request(app)
      .get(`/api/v1/quiz/${created.body.data._id}`)
      .set(authHeader(token))

    expect(res.body.data.hasAttempted).toBeUndefined()
  })
})

describe("updating examMode", () => {
  it("lets the owner toggle examMode on an existing personal quiz", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id)

    const created = await request(app)
      .post("/api/v1/quiz")
      .set(authHeader(token))
      .send({ title: "Togglable Quiz", questionIds: [question._id.toString()] })
    expect(created.body.data.examMode).toBe(false)

    const updated = await request(app)
      .put(`/api/v1/quiz/${created.body.data._id}`)
      .set(authHeader(token))
      .send({ examMode: true })

    expect(updated.status).toBe(202)
    expect(updated.body.data.examMode).toBe(true)
  })
})
