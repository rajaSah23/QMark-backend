"use strict"

const request = require("supertest")
const app = require("../app")
const Community = require("../modules/community/model")
const CommunityQuestion = require("../modules/community/questionModel")
const { createUser, createQuestion, authHeader } = require("./helpers/factories")

const makeCommunity = async (token, overrides = {}) => {
  const res = await request(app)
    .post("/api/v1/community")
    .set(authHeader(token))
    .send({ name: "Sharing Group", ...overrides })
  expect(res.status).toBe(201)
  return res.body.data
}

const joinAs = async (communityId, token) => {
  await request(app)
    .post(`/api/v1/community/${communityId}/join`)
    .set(authHeader(token))
}

describe("sharing questions into a community", () => {
  it("lets the author share their own question", async () => {
    const owner = await createUser()
    const question = await createQuestion(owner.user._id, { question: "Shared?" })
    const community = await makeCommunity(owner.token)

    const res = await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(owner.token))
      .send({ questionId: question._id.toString() })

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe("approved")

    const fresh = await Community.findById(community._id)
    expect(fresh.questionCount).toBe(1)
  })

  it("refuses to share someone else's question", async () => {
    const owner = await createUser()
    const sharer = await createUser()
    const question = await createQuestion(owner.user._id)
    const community = await makeCommunity(sharer.token)

    const res = await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(sharer.token))
      .send({ questionId: question._id.toString() })

    expect(res.status).toBe(403)
  })

  it("refuses to share the same question twice", async () => {
    const owner = await createUser()
    const question = await createQuestion(owner.user._id)
    const community = await makeCommunity(owner.token)

    await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(owner.token))
      .send({ questionId: question._id.toString() });

    const second = await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(owner.token))
      .send({ questionId: question._id.toString() });

    expect(second.status).toBe(400)
  })

  it("requires the sharer to be a member first", async () => {
    const owner = await createUser()
    const outsider = await createUser()
    const question = await createQuestion(outsider.user._id)
    const community = await makeCommunity(owner.token)

    const res = await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(outsider.token))
      .send({ questionId: question._id.toString() })

    expect(res.status).toBe(403)
  })

  it("routes shares into a pending queue when the community requires approval", async () => {
    const owner = await createUser()
    const member = await createUser()
    const community = await makeCommunity(owner.token, { requiresApproval: true })
    await joinAs(community._id, member.token)

    const question = await createQuestion(member.user._id)
    const res = await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(member.token))
      .send({ questionId: question._id.toString() })

    expect(res.body.data.status).toBe("pending")
    const fresh = await Community.findById(community._id)
    expect(fresh.questionCount).toBe(0)
  })

  it("lets a moderator's own shares skip the approval queue", async () => {
    const owner = await createUser()
    const community = await makeCommunity(owner.token, { requiresApproval: true })
    const question = await createQuestion(owner.user._id)

    const res = await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(owner.token))
      .send({ questionId: question._id.toString() })

    expect(res.body.data.status).toBe("approved")
  })
})

describe("member access to shared questions", () => {
  it("lets a member answer a question shared by someone else", async () => {
    const owner = await createUser()
    const member = await createUser()
    const community = await makeCommunity(owner.token)
    await joinAs(community._id, member.token)

    const question = await createQuestion(owner.user._id)
    await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(owner.token))
      .send({ questionId: question._id.toString() })

    const res = await request(app)
      .post(`/api/v1/mcq/${question._id}/option-click`)
      .set(authHeader(member.token))
      .send({ selectedAnswer: "4" })

    expect(res.status).toBe(201)
  })

  it("lets a member bookmark a shared question without affecting the author's copy", async () => {
    const owner = await createUser()
    const member = await createUser()
    const community = await makeCommunity(owner.token)
    await joinAs(community._id, member.token)

    const question = await createQuestion(owner.user._id)
    await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(owner.token))
      .send({ questionId: question._id.toString() })

    await request(app)
      .patch("/api/v1/mcq")
      .set(authHeader(member.token))
      .send({ questionId: question._id.toString(), bookmark: true })

    const ownerView = await request(app)
      .get(`/api/v1/mcq/${question._id}`)
      .set(authHeader(owner.token))
    expect(ownerView.status).toBe(200)

    const ownerList = await request(app).get("/api/v1/mcq").set(authHeader(owner.token))
    expect(ownerList.body.data.results[0].bookmark).toBe(false)
  })

  it("denies a non-member reading a shared question directly", async () => {
    const owner = await createUser()
    const outsider = await createUser()
    const community = await makeCommunity(owner.token)

    const question = await createQuestion(owner.user._id)
    await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(owner.token))
      .send({ questionId: question._id.toString() })

    const res = await request(app)
      .get(`/api/v1/mcq/${question._id}`)
      .set(authHeader(outsider.token))

    expect(res.status).toBe(403)
  })

  it("still denies editing a shared question to a non-author member", async () => {
    const owner = await createUser()
    const member = await createUser()
    const community = await makeCommunity(owner.token)
    await joinAs(community._id, member.token)

    const question = await createQuestion(owner.user._id, { question: "Original?" })
    await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(owner.token))
      .send({ questionId: question._id.toString() })

    const res = await request(app)
      .put("/api/v1/mcq")
      .set(authHeader(member.token))
      .send({ questionId: question._id.toString(), question: "Hijacked" })

    expect(res.status).toBe(403)
  })

  it("revokes access the moment a question is unshared", async () => {
    const owner = await createUser()
    const member = await createUser()
    const community = await makeCommunity(owner.token)
    await joinAs(community._id, member.token)

    const question = await createQuestion(owner.user._id)
    await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(owner.token))
      .send({ questionId: question._id.toString() })

    await request(app)
      .delete(`/api/v1/community/${community._id}/questions/${question._id}`)
      .set(authHeader(owner.token))

    const res = await request(app)
      .get(`/api/v1/mcq/${question._id}`)
      .set(authHeader(member.token))

    expect(res.status).toBe(403)
    const fresh = await Community.findById(community._id)
    expect(fresh.questionCount).toBe(0)
  })

  it("does not grant access via a DIFFERENT community the user isn't in", async () => {
    const owner = await createUser()
    const outsider = await createUser()
    const communityA = await makeCommunity(owner.token, { name: "Group A" })
    const communityB = await makeCommunity(owner.token, { name: "Group B" })
    await joinAs(communityB._id, outsider.token)

    const question = await createQuestion(owner.user._id)
    await request(app)
      .post(`/api/v1/community/${communityA._id}/questions`)
      .set(authHeader(owner.token))
      .send({ questionId: question._id.toString() })

    const res = await request(app)
      .get(`/api/v1/mcq/${question._id}`)
      .set(authHeader(outsider.token))

    expect(res.status).toBe(403)
  })
})

describe("unsharing", () => {
  it("lets the sharer undo their own share", async () => {
    const owner = await createUser()
    const community = await makeCommunity(owner.token)
    const question = await createQuestion(owner.user._id)
    await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(owner.token))
      .send({ questionId: question._id.toString() })

    const res = await request(app)
      .delete(`/api/v1/community/${community._id}/questions/${question._id}`)
      .set(authHeader(owner.token))

    expect(res.status).toBe(202)
    expect(await CommunityQuestion.countDocuments({})).toBe(0)
  })

  it("lets a moderator remove someone else's shared question", async () => {
    const owner = await createUser()
    const member = await createUser()
    const community = await makeCommunity(owner.token)
    await joinAs(community._id, member.token)

    const question = await createQuestion(member.user._id)
    await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(member.token))
      .send({ questionId: question._id.toString() })

    const res = await request(app)
      .delete(`/api/v1/community/${community._id}/questions/${question._id}`)
      .set(authHeader(owner.token))

    expect(res.status).toBe(202)
  })

  it("stops a plain member from unsharing someone else's question", async () => {
    const owner = await createUser()
    const memberA = await createUser()
    const memberB = await createUser()
    const community = await makeCommunity(owner.token)
    await joinAs(community._id, memberA.token)
    await joinAs(community._id, memberB.token)

    const question = await createQuestion(memberA.user._id)
    await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(memberA.token))
      .send({ questionId: question._id.toString() })

    const res = await request(app)
      .delete(`/api/v1/community/${community._id}/questions/${question._id}`)
      .set(authHeader(memberB.token))

    expect(res.status).toBe(403)
  })
})

describe("moderation queue", () => {
  it("lets a moderator approve a pending question, granting access", async () => {
    const owner = await createUser()
    const member = await createUser()
    const community = await makeCommunity(owner.token, { requiresApproval: true })
    await joinAs(community._id, member.token)

    const question = await createQuestion(member.user._id)
    const shared = await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(member.token))
      .send({ questionId: question._id.toString() })

    const approve = await request(app)
      .post(`/api/v1/community/shares/${shared.body.data._id}/moderate`)
      .set(authHeader(owner.token))
      .send({ action: "accept" })

    expect(approve.body.data.status).toBe("approved")

    const list = await request(app)
      .get(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(owner.token))
    expect(list.body.data.results).toHaveLength(1)

    const fresh = await Community.findById(community._id)
    expect(fresh.questionCount).toBe(1)
  })

  it("keeps a rejected question invisible to members", async () => {
    const owner = await createUser()
    const member = await createUser()
    const community = await makeCommunity(owner.token, { requiresApproval: true })
    await joinAs(community._id, member.token)

    const question = await createQuestion(member.user._id)
    const shared = await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(member.token))
      .send({ questionId: question._id.toString() })

    await request(app)
      .post(`/api/v1/community/shares/${shared.body.data._id}/moderate`)
      .set(authHeader(owner.token))
      .send({ action: "reject" })

    // The author (member) still sees their own question directly — rejection
    // only withholds community-wide access, it doesn't touch authorship.
    const authorView = await request(app)
      .get(`/api/v1/mcq/${question._id}`)
      .set(authHeader(member.token))
    expect(authorView.status).toBe(200)

    // The community admin, who is NOT the author, must NOT gain access via a
    // rejected share.
    const nonAuthorView = await request(app)
      .get(`/api/v1/mcq/${question._id}`)
      .set(authHeader(owner.token))
    expect(nonAuthorView.status).toBe(403)

    const list = await request(app)
      .get(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(owner.token))
    expect(list.body.data.results).toHaveLength(0)
  })

  it("stops a plain member from moderating", async () => {
    const owner = await createUser()
    const member = await createUser()
    const community = await makeCommunity(owner.token, { requiresApproval: true })
    await joinAs(community._id, member.token)

    const question = await createQuestion(member.user._id)
    const shared = await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(member.token))
      .send({ questionId: question._id.toString() })

    const res = await request(app)
      .post(`/api/v1/community/shares/${shared.body.data._id}/moderate`)
      .set(authHeader(member.token))
      .send({ action: "accept" })

    expect(res.status).toBe(403)
  })

  it("refuses to re-review an already-resolved share", async () => {
    const owner = await createUser()
    const community = await makeCommunity(owner.token, { requiresApproval: true })

    // Use a non-moderator member so the share actually lands pending.
    const member = await createUser()
    await joinAs(community._id, member.token)
    const memberQuestion = await createQuestion(member.user._id)
    const shared = await request(app)
      .post(`/api/v1/community/${community._id}/questions`)
      .set(authHeader(member.token))
      .send({ questionId: memberQuestion._id.toString() })

    const url = `/api/v1/community/shares/${shared.body.data._id}/moderate`
    await request(app).post(url).set(authHeader(owner.token)).send({ action: "accept" })
    const second = await request(app).post(url).set(authHeader(owner.token)).send({ action: "accept" })

    expect(second.status).toBe(400)
  })
})

describe("getQuestionShares", () => {
  it("lists which of the author's communities a question is shared into", async () => {
    const owner = await createUser()
    const communityA = await makeCommunity(owner.token, { name: "Group A" })
    const communityB = await makeCommunity(owner.token, { name: "Group B" })
    const question = await createQuestion(owner.user._id)

    await request(app)
      .post(`/api/v1/community/${communityA._id}/questions`)
      .set(authHeader(owner.token))
      .send({ questionId: question._id.toString() })

    const res = await request(app)
      .get(`/api/v1/community/questions/${question._id}/shares`)
      .set(authHeader(owner.token))

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].community.name).toBe("Group A")
  })

  it("stops a non-author from listing another user's shares", async () => {
    const owner = await createUser()
    const outsider = await createUser()
    const question = await createQuestion(owner.user._id)

    const res = await request(app)
      .get(`/api/v1/community/questions/${question._id}/shares`)
      .set(authHeader(outsider.token))

    expect(res.status).toBe(403)
  })
})
