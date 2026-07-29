"use strict"

const request = require("supertest")
const app = require("../app")
const MCQ = require("../modules/mcq/model")
const UserQuestionState = require("../modules/mcq/userQuestionStateModel")
const { createUser, createQuestion, authHeader } = require("./helpers/factories")

describe("per-user bookmarks", () => {
  it("defaults to bookmark:false in the question list", async () => {
    const { user, token } = await createUser()
    await createQuestion(user._id)

    const res = await request(app).get("/api/v1/mcq").set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.data.results[0].bookmark).toBe(false)
  })

  it("persists a bookmark and reflects it in the list", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id)

    await request(app)
      .patch("/api/v1/mcq")
      .set(authHeader(token))
      .send({ questionId: question._id.toString(), bookmark: true })

    const res = await request(app).get("/api/v1/mcq").set(authHeader(token))
    expect(res.body.data.results[0].bookmark).toBe(true)
  })

  it("unbookmarks without creating a duplicate state row", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id)

    for (const bookmark of [true, false, true, false]) {
      await request(app)
        .patch("/api/v1/mcq")
        .set(authHeader(token))
        .send({ questionId: question._id.toString(), bookmark })
    }

    const rows = await UserQuestionState.find({ question: question._id })
    expect(rows).toHaveLength(1)
    expect(rows[0].bookmarked).toBe(false)
  })

  it("filters to bookmarked questions with ?bookmark=true", async () => {
    const { user, token } = await createUser()
    const kept = await createQuestion(user._id, { question: "Kept?" })
    await createQuestion(user._id, { question: "Ignored?" })

    await request(app)
      .patch("/api/v1/mcq")
      .set(authHeader(token))
      .send({ questionId: kept._id.toString(), bookmark: true })

    const res = await request(app)
      .get("/api/v1/mcq?bookmark=true")
      .set(authHeader(token))

    expect(res.body.data.results).toHaveLength(1)
    expect(res.body.data.results[0].question).toBe("Kept?")
    expect(res.body.data.total).toBe(1)
  })

  it("keeps one user's bookmark invisible to another user", async () => {
    // Two users each authoring an identical question. User A bookmarks theirs;
    // user B must not see a bookmark on their own copy. Under the old schema,
    // where `bookmark` lived on the MCQ document, this is the case that broke.
    const userA = await createUser()
    const userB = await createUser()
    const questionA = await createQuestion(userA.user._id, { question: "Shared?" })
    await createQuestion(userB.user._id, { question: "Shared?" })

    await request(app)
      .patch("/api/v1/mcq")
      .set(authHeader(userA.token))
      .send({ questionId: questionA._id.toString(), bookmark: true })

    const resA = await request(app).get("/api/v1/mcq").set(authHeader(userA.token))
    const resB = await request(app).get("/api/v1/mcq").set(authHeader(userB.token))

    expect(resA.body.data.results[0].bookmark).toBe(true)
    expect(resB.body.data.results[0].bookmark).toBe(false)
  })

  it("no longer stores bookmark on the question document", async () => {
    const { user, token } = await createUser()
    const question = await createQuestion(user._id)

    await request(app)
      .patch("/api/v1/mcq")
      .set(authHeader(token))
      .send({ questionId: question._id.toString(), bookmark: true })

    const raw = await MCQ.findById(question._id).lean()
    expect(raw.bookmark).toBeUndefined()
  })
})

describe("MCQ permission matrix", () => {
  describe("the author is allowed", () => {
    it("reads their own question", async () => {
      const { user, token } = await createUser()
      const question = await createQuestion(user._id)

      const res = await request(app)
        .get(`/api/v1/mcq/${question._id}`)
        .set(authHeader(token))

      expect(res.status).toBe(200)
      expect(res.body.data._id).toBe(question._id.toString())
    })

    it("answers their own question", async () => {
      const { user, token } = await createUser()
      const question = await createQuestion(user._id)

      const res = await request(app)
        .post(`/api/v1/mcq/${question._id}/option-click`)
        .set(authHeader(token))
        .send({ selectedAnswer: "4" })

      expect(res.status).toBe(201)
      expect(res.body.data.isCorrect).toBe(true)
    })

    it("edits their own question", async () => {
      const { user, token } = await createUser()
      const question = await createQuestion(user._id)

      const res = await request(app)
        .put("/api/v1/mcq")
        .set(authHeader(token))
        .send({ questionId: question._id.toString(), question: "Updated?" })

      expect(res.status).toBe(202)
      expect(res.body.data.question).toBe("Updated?")
    })

    it("deletes their own question", async () => {
      const { user, token } = await createUser()
      const question = await createQuestion(user._id)

      const res = await request(app)
        .delete(`/api/v1/mcq/${question._id}`)
        .set(authHeader(token))

      expect(res.status).toBe(202)
    })

    it("sees only their own questions in the list", async () => {
      const author = await createUser()
      const stranger = await createUser()
      await createQuestion(author.user._id, { question: "Mine?" })
      await createQuestion(stranger.user._id, { question: "Theirs?" })

      const res = await request(app)
        .get("/api/v1/mcq")
        .set(authHeader(author.token))

      expect(res.status).toBe(200)
      expect(res.body.data.results).toHaveLength(1)
      expect(res.body.data.results[0].question).toBe("Mine?")
    })
  })

  describe("a non-author is denied", () => {
    const cases = [
      [
        "reading",
        (app, question, token) =>
          request(app).get(`/api/v1/mcq/${question._id}`).set(authHeader(token))
      ],
      [
        "answering",
        (app, question, token) =>
          request(app)
            .post(`/api/v1/mcq/${question._id}/option-click`)
            .set(authHeader(token))
            .send({ selectedAnswer: "4" })
      ],
      [
        "bookmarking",
        (app, question, token) =>
          request(app)
            .patch("/api/v1/mcq")
            .set(authHeader(token))
            .send({ questionId: question._id.toString(), bookmark: true })
      ],
      [
        "editing",
        (app, question, token) =>
          request(app)
            .put("/api/v1/mcq")
            .set(authHeader(token))
            .send({ questionId: question._id.toString(), question: "Hijacked" })
      ],
      [
        "deleting",
        (app, question, token) =>
          request(app)
            .delete(`/api/v1/mcq/${question._id}`)
            .set(authHeader(token))
      ],
      [
        "reading interaction detail",
        (app, question, token) =>
          request(app)
            .get(`/api/v1/mcq/${question._id}/interactions`)
            .set(authHeader(token))
      ],
      [
        "commenting",
        (app, question, token) =>
          request(app)
            .post(`/api/v1/mcq/${question._id}/comments`)
            .set(authHeader(token))
            .send({ comment: "Sneaky" })
      ]
    ]

    it.each(cases)("denies %s someone else's question", async (_label, act) => {
      const author = await createUser()
      const stranger = await createUser()
      const question = await createQuestion(author.user._id)

      const res = await act(app, question, stranger.token)

      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    })

    it("does not let a denied bookmark create any state row", async () => {
      const author = await createUser()
      const stranger = await createUser()
      const question = await createQuestion(author.user._id)

      await request(app)
        .patch("/api/v1/mcq")
        .set(authHeader(stranger.token))
        .send({ questionId: question._id.toString(), bookmark: true })

      expect(await UserQuestionState.countDocuments({})).toBe(0)
    })

    it("does not let a denied edit change the question", async () => {
      const author = await createUser()
      const stranger = await createUser()
      const question = await createQuestion(author.user._id, {
        question: "Original?"
      })

      await request(app)
        .put("/api/v1/mcq")
        .set(authHeader(stranger.token))
        .send({ questionId: question._id.toString(), question: "Hijacked" })

      const raw = await MCQ.findById(question._id).lean()
      expect(raw.question).toBe("Original?")
    })

    it("does not let a denied delete remove the question", async () => {
      const author = await createUser()
      const stranger = await createUser()
      const question = await createQuestion(author.user._id)

      await request(app)
        .delete(`/api/v1/mcq/${question._id}`)
        .set(authHeader(stranger.token))

      expect(await MCQ.countDocuments({ _id: question._id })).toBe(1)
    })
  })

  describe("unauthenticated access", () => {
    const routes = [
      ["get", "/api/v1/mcq"],
      ["post", "/api/v1/mcq"],
      ["put", "/api/v1/mcq"],
      ["patch", "/api/v1/mcq"]
    ]

    it.each(routes)("rejects %s %s without a token", async (method, path) => {
      const res = await request(app)[method](path).send({})
      expect(res.status).toBe(401)
    })

    it("rejects reading a question without a token", async () => {
      const { user } = await createUser()
      const question = await createQuestion(user._id)

      const res = await request(app).get(`/api/v1/mcq/${question._id}`)
      expect(res.status).toBe(401)
    })
  })
})
