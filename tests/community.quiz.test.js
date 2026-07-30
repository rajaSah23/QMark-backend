"use strict"

const request = require("supertest")
const app = require("../app")
const { createUser, createQuestion, authHeader } = require("./helpers/factories")

const makeCommunity = async (token, overrides = {}) => {
  const res = await request(app)
    .post("/api/v1/community")
    .set(authHeader(token))
    .send({ name: "Quiz Group", ...overrides })
  expect(res.status).toBe(201)
  return res.body.data
}

const joinAs = async (communityId, token) => {
  await request(app)
    .post(`/api/v1/community/${communityId}/join`)
    .set(authHeader(token))
}

/** Author shares one approved question into the community and returns its id. */
const shareApprovedQuestion = async (community, authorToken, authorId, overrides = {}) => {
  const question = await createQuestion(authorId, overrides)
  await request(app)
    .post(`/api/v1/community/${community._id}/questions`)
    .set(authHeader(authorToken))
    .send({ questionId: question._id.toString() })
  return question
}

const createCommunityQuiz = (communityId, questionIds, adminToken, overrides = {}) =>
  request(app)
    .post("/api/v1/quiz")
    .set(authHeader(adminToken))
    .send({
      title: "Weekly Test",
      communityId,
      questionIds: questionIds.map((id) => id.toString()),
      ...overrides
    })

describe("creating a community quiz", () => {
  it("lets an admin create a quiz from approved shared questions", async () => {
    const admin = await createUser()
    const community = await makeCommunity(admin.token)
    const question = await shareApprovedQuestion(community, admin.token, admin.user._id)

    const res = await createCommunityQuiz(community._id, [question._id], admin.token)

    expect(res.status).toBe(201)
    expect(res.body.data.community).toBe(community._id)
  })

  it("stops a plain member from creating a community quiz", async () => {
    const admin = await createUser()
    const member = await createUser()
    const community = await makeCommunity(admin.token)
    await joinAs(community._id, member.token)
    const question = await shareApprovedQuestion(community, admin.token, admin.user._id)

    const res = await createCommunityQuiz(community._id, [question._id], member.token)

    expect(res.status).toBe(403)
  })

  it("lets a moderator create a community quiz", async () => {
    const admin = await createUser()
    const moderator = await createUser()
    const community = await makeCommunity(admin.token)
    await joinAs(community._id, moderator.token)
    await request(app)
      .patch(`/api/v1/community/${community._id}/members/${moderator.user._id}`)
      .set(authHeader(admin.token))
      .send({ role: "moderator" })
    const question = await shareApprovedQuestion(community, admin.token, admin.user._id)

    const res = await createCommunityQuiz(community._id, [question._id], moderator.token)

    expect(res.status).toBe(201)
  })

  it("refuses a question that isn't shared and approved in the community", async () => {
    const admin = await createUser()
    const community = await makeCommunity(admin.token)
    // Author their own question but never share it.
    const unshared = await createQuestion(admin.user._id)

    const res = await createCommunityQuiz(community._id, [unshared._id], admin.token)

    expect(res.status).toBe(400)
  })

  it("refuses a question shared only in a DIFFERENT community", async () => {
    const admin = await createUser()
    const communityA = await makeCommunity(admin.token, { name: "Group A" })
    const communityB = await makeCommunity(admin.token, { name: "Group B" })
    const question = await shareApprovedQuestion(communityA, admin.token, admin.user._id)

    const res = await createCommunityQuiz(communityB._id, [question._id], admin.token)

    expect(res.status).toBe(400)
  })

  it("refuses a pending (not yet approved) shared question", async () => {
    const admin = await createUser()
    const member = await createUser()
    const community = await makeCommunity(admin.token, { requiresApproval: true })
    await joinAs(community._id, member.token)

    const question = await createQuestion(member.user._id)
    await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(member.token))
      .send({ questionId: question._id.toString() })
    // Left pending — admin never approved it.

    const res = await createCommunityQuiz(community._id, [question._id], admin.token)

    expect(res.status).toBe(400)
  })
})

describe("member access to a community quiz", () => {
  const setupQuiz = async () => {
    const admin = await createUser()
    const member = await createUser()
    const community = await makeCommunity(admin.token)
    await joinAs(community._id, member.token)
    const question = await shareApprovedQuestion(community, admin.token, admin.user._id, {
      correctAnswer: "4"
    })
    const created = await createCommunityQuiz(community._id, [question._id], admin.token)
    return { admin, member, community, question, quiz: created.body.data }
  }

  it("lets a member view and attempt the quiz", async () => {
    const { member, quiz, question } = await setupQuiz()

    const view = await request(app)
      .get(`/api/v1/quiz/${quiz._id}`)
      .set(authHeader(member.token))
    expect(view.status).toBe(200)

    const attempt = await request(app)
      .post(`/api/v1/quiz/${quiz._id}/attempt`)
      .set(authHeader(member.token))
      .send({ answers: [{ question: question._id.toString(), selectedAnswer: "4" }] })

    expect(attempt.status).toBe(201)
    expect(attempt.body.data.score).toBe(1)
  })

  it("denies a non-member entirely", async () => {
    const { quiz } = await setupQuiz()
    const outsider = await createUser()

    const res = await request(app)
      .get(`/api/v1/quiz/${quiz._id}`)
      .set(authHeader(outsider.token))

    expect(res.status).toBe(403)
  })

  it("blocks a second attempt at the same community quiz", async () => {
    const { member, quiz, question } = await setupQuiz()

    await request(app)
      .post(`/api/v1/quiz/${quiz._id}/attempt`)
      .set(authHeader(member.token))
      .send({ answers: [{ question: question._id.toString(), selectedAnswer: "4" }] })

    const second = await request(app)
      .post(`/api/v1/quiz/${quiz._id}/attempt`)
      .set(authHeader(member.token))
      .send({ answers: [{ question: question._id.toString(), selectedAnswer: "4" }] })

    expect(second.status).toBe(400)
  })

  it("stops a non-manager member from editing or deleting the quiz", async () => {
    const { member, quiz } = await setupQuiz()

    const editRes = await request(app)
      .put(`/api/v1/quiz/${quiz._id}`)
      .set(authHeader(member.token))
      .send({ title: "Hijacked" })
    expect(editRes.status).toBe(403)

    const deleteRes = await request(app)
      .delete(`/api/v1/quiz/${quiz._id}`)
      .set(authHeader(member.token))
    expect(deleteRes.status).toBe(403)
  })
})

describe("leaderboard and publishing", () => {
  const setupWithTwoAttempts = async () => {
    const admin = await createUser()
    const memberA = await createUser()
    const memberB = await createUser()
    const community = await makeCommunity(admin.token)
    await joinAs(community._id, memberA.token)
    await joinAs(community._id, memberB.token)

    const q1 = await shareApprovedQuestion(community, admin.token, admin.user._id, {
      question: "Q1?",
      correctAnswer: "4"
    })
    const q2 = await shareApprovedQuestion(community, admin.token, admin.user._id, {
      question: "Q2?",
      correctAnswer: "4"
    })

    const created = await createCommunityQuiz(
      community._id,
      [q1._id, q2._id],
      admin.token
    )
    const quiz = created.body.data

    // memberA gets both right, memberB gets one right.
    await request(app)
      .post(`/api/v1/quiz/${quiz._id}/attempt`)
      .set(authHeader(memberA.token))
      .send({
        answers: [
          { question: q1._id.toString(), selectedAnswer: "4" },
          { question: q2._id.toString(), selectedAnswer: "4" }
        ]
      })
    await request(app)
      .post(`/api/v1/quiz/${quiz._id}/attempt`)
      .set(authHeader(memberB.token))
      .send({
        answers: [
          { question: q1._id.toString(), selectedAnswer: "4" },
          { question: q2._id.toString(), selectedAnswer: "3" }
        ]
      })

    return { admin, memberA, memberB, community, quiz }
  }

  it("hides the leaderboard from members until published", async () => {
    const { memberA, quiz } = await setupWithTwoAttempts()

    const res = await request(app)
      .get(`/api/v1/quiz/${quiz._id}/leaderboard`)
      .set(authHeader(memberA.token))

    expect(res.status).toBe(403)
  })

  it("lets the admin preview the leaderboard before publishing", async () => {
    const { admin, quiz } = await setupWithTwoAttempts()

    const res = await request(app)
      .get(`/api/v1/quiz/${quiz._id}/leaderboard`)
      .set(authHeader(admin.token))

    expect(res.status).toBe(200)
    expect(res.body.data.resultsPublished).toBe(false)
    expect(res.body.data.entries).toHaveLength(2)
  })

  it("ranks by score after publishing and reveals it to all members", async () => {
    const { admin, memberA, memberB, quiz } = await setupWithTwoAttempts()

    const publish = await request(app)
      .post(`/api/v1/quiz/${quiz._id}/publish`)
      .set(authHeader(admin.token))
    expect(publish.status).toBe(202)

    const res = await request(app)
      .get(`/api/v1/quiz/${quiz._id}/leaderboard`)
      .set(authHeader(memberB.token))

    expect(res.status).toBe(200)
    expect(res.body.data.resultsPublished).toBe(true)
    expect(res.body.data.entries[0].rank).toBe(1)
    expect(res.body.data.entries[0].score).toBe(2)
    expect(res.body.data.entries[0].user.name).toBe(memberA.user.name)
    expect(res.body.data.entries[1].score).toBe(1)
    expect(res.body.data.entries[1].isYou).toBe(true)
  })

  it("stops a plain member from publishing", async () => {
    const { memberA, quiz } = await setupWithTwoAttempts()

    const res = await request(app)
      .post(`/api/v1/quiz/${quiz._id}/publish`)
      .set(authHeader(memberA.token))

    expect(res.status).toBe(403)
  })

  it("refuses to publish twice", async () => {
    const { admin, quiz } = await setupWithTwoAttempts()

    await request(app).post(`/api/v1/quiz/${quiz._id}/publish`).set(authHeader(admin.token))
    const second = await request(app)
      .post(`/api/v1/quiz/${quiz._id}/publish`)
      .set(authHeader(admin.token))

    expect(second.status).toBe(400)
  })

  it("refuses publish/leaderboard on a personal (non-community) quiz", async () => {
    const owner = await createUser()
    const question = await createQuestion(owner.user._id)

    const created = await request(app)
      .post("/api/v1/quiz")
      .set(authHeader(owner.token))
      .send({ title: "Personal Quiz", questionIds: [question._id.toString()] })

    const publish = await request(app)
      .post(`/api/v1/quiz/${created.body.data._id}/publish`)
      .set(authHeader(owner.token))
    expect(publish.status).toBe(400)

    const leaderboard = await request(app)
      .get(`/api/v1/quiz/${created.body.data._id}/leaderboard`)
      .set(authHeader(owner.token))
    expect(leaderboard.status).toBe(400)
  })
})

describe("listing community quizzes", () => {
  it("lists a community's quizzes to its members", async () => {
    const admin = await createUser()
    const member = await createUser()
    const community = await makeCommunity(admin.token)
    await joinAs(community._id, member.token)
    const question = await shareApprovedQuestion(community, admin.token, admin.user._id)
    await createCommunityQuiz(community._id, [question._id], admin.token)

    const res = await request(app)
      .get(`/api/v1/quiz?communityId=${community._id}`)
      .set(authHeader(member.token))

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it("denies listing to a non-member", async () => {
    const admin = await createUser()
    const outsider = await createUser()
    const community = await makeCommunity(admin.token)

    const res = await request(app)
      .get(`/api/v1/quiz?communityId=${community._id}`)
      .set(authHeader(outsider.token))

    expect(res.status).toBe(403)
  })

  it("does not leak community quizzes into a user's personal quiz list", async () => {
    const admin = await createUser()
    const community = await makeCommunity(admin.token)
    const question = await shareApprovedQuestion(community, admin.token, admin.user._id)
    await createCommunityQuiz(community._id, [question._id], admin.token)

    const res = await request(app).get("/api/v1/quiz").set(authHeader(admin.token))

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })
})
