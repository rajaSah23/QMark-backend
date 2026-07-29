"use strict"

const request = require("supertest")
const app = require("../app")
const Community = require("../modules/community/model")
const CommunityMember = require("../modules/community/memberModel")
const { createUser, authHeader } = require("./helpers/factories")

/** Creates a community owned by `token`'s user and returns the response body. */
const makeCommunity = async (token, overrides = {}) => {
  const res = await request(app)
    .post("/api/v1/community")
    .set(authHeader(token))
    .send({ name: "UPSC Prelims Group", ...overrides })
  expect(res.status).toBe(201)
  return res.body.data
}

describe("community creation", () => {
  it("creates a community and makes the creator an admin", async () => {
    const { user, token } = await createUser()
    const community = await makeCommunity(token, { name: "SSC CGL Warriors" })

    expect(community.name).toBe("SSC CGL Warriors")
    expect(community.slug).toBe("ssc-cgl-warriors")
    expect(community.visibility).toBe("public")
    expect(community.memberCount).toBe(1)
    expect(community.viewerRole).toBe("admin")

    const membership = await CommunityMember.findOne({
      community: community._id,
      user: user._id
    })
    expect(membership.role).toBe("admin")
  })

  it("gives colliding names distinct slugs", async () => {
    const a = await createUser()
    const b = await createUser()
    const first = await makeCommunity(a.token, { name: "Banking Aspirants" })
    const second = await makeCommunity(b.token, { name: "Banking Aspirants" })

    expect(first.slug).toBe("banking-aspirants")
    expect(second.slug).toBe("banking-aspirants-2")
  })

  it("rejects a name shorter than 3 characters", async () => {
    const { token } = await createUser()
    const res = await request(app)
      .post("/api/v1/community")
      .set(authHeader(token))
      .send({ name: "AB" })

    expect(res.status).toBe(400)
  })

  it("requires authentication", async () => {
    const res = await request(app).post("/api/v1/community").send({ name: "Nope" })
    expect(res.status).toBe(401)
  })
})

describe("community listing", () => {
  it("lists public and private communities but marks membership", async () => {
    const owner = await createUser()
    const outsider = await createUser()
    await makeCommunity(owner.token, { name: "Public Group" })
    await makeCommunity(owner.token, {
      name: "Private Group",
      visibility: "private"
    })

    const res = await request(app)
      .get("/api/v1/community")
      .set(authHeader(outsider.token))

    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(2)
    for (const item of res.body.data.results) {
      expect(item.isMember).toBe(false)
      expect(item.viewerRole).toBeNull()
    }
  })

  it("searches by name", async () => {
    const { token } = await createUser()
    await makeCommunity(token, { name: "Railway Exam Prep" })
    await makeCommunity(token, { name: "Banking Aspirants" })

    const res = await request(app)
      .get("/api/v1/community?search=railway")
      .set(authHeader(token))

    expect(res.body.data.results).toHaveLength(1)
    expect(res.body.data.results[0].name).toBe("Railway Exam Prep")
  })

  it("filters by visibility", async () => {
    const { token } = await createUser()
    await makeCommunity(token, { name: "Open Group" })
    await makeCommunity(token, { name: "Closed Group", visibility: "private" })

    const res = await request(app)
      .get("/api/v1/community?visibility=private")
      .set(authHeader(token))

    expect(res.body.data.results).toHaveLength(1)
    expect(res.body.data.results[0].name).toBe("Closed Group")
  })

  it("sorts by score when sortBy=top", async () => {
    const owner = await createUser()
    const voter = await createUser()
    const low = await makeCommunity(owner.token, { name: "Low Group" })
    const high = await makeCommunity(owner.token, { name: "High Group" })

    await request(app)
      .post(`/api/v1/community/${high._id}/react`)
      .set(authHeader(voter.token))
      .send({ value: 1 })

    const res = await request(app)
      .get("/api/v1/community?sortBy=top")
      .set(authHeader(voter.token))

    expect(res.body.data.results[0].name).toBe("High Group")
    expect(res.body.data.results[0].score).toBe(1)
    expect(res.body.data.results[1]._id).toBe(low._id.toString())
  })

  it("returns only my communities with mine=true", async () => {
    const mine = await createUser()
    const other = await createUser()
    await makeCommunity(mine.token, { name: "My Group" })
    await makeCommunity(other.token, { name: "Their Group" })

    const res = await request(app)
      .get("/api/v1/community?mine=true")
      .set(authHeader(mine.token))

    expect(res.body.data.results).toHaveLength(1)
    expect(res.body.data.results[0].name).toBe("My Group")
  })

  it("excludes soft-deleted communities", async () => {
    const { token } = await createUser()
    const community = await makeCommunity(token, { name: "Doomed Group" })

    await request(app)
      .delete(`/api/v1/community/${community._id}`)
      .set(authHeader(token))

    const res = await request(app)
      .get("/api/v1/community")
      .set(authHeader(token))
    expect(res.body.data.total).toBe(0)
  })
})

describe("joining", () => {
  it("lets anyone join a public community instantly", async () => {
    const owner = await createUser()
    const joiner = await createUser()
    const community = await makeCommunity(owner.token, { name: "Open Doors" })

    const res = await request(app)
      .post(`/api/v1/community/${community._id}/join`)
      .set(authHeader(joiner.token))

    expect(res.status).toBe(201)
    expect(res.body.data).toEqual({ joined: true, status: "member" })

    const fresh = await Community.findById(community._id)
    expect(fresh.memberCount).toBe(2)
  })

  it("puts a private-community join into a pending request", async () => {
    const owner = await createUser()
    const joiner = await createUser()
    const community = await makeCommunity(owner.token, {
      name: "Closed Doors",
      visibility: "private"
    })

    const res = await request(app)
      .post(`/api/v1/community/${community._id}/join`)
      .set(authHeader(joiner.token))

    expect(res.body.data).toEqual({ joined: false, status: "pending" })

    const fresh = await Community.findById(community._id)
    expect(fresh.memberCount).toBe(1)
  })

  it("refuses to join twice", async () => {
    const owner = await createUser()
    const joiner = await createUser()
    const community = await makeCommunity(owner.token, { name: "Open Doors" })

    await request(app)
      .post(`/api/v1/community/${community._id}/join`)
      .set(authHeader(joiner.token))
    const second = await request(app)
      .post(`/api/v1/community/${community._id}/join`)
      .set(authHeader(joiner.token))

    expect(second.status).toBe(400)
  })

  it("refuses a duplicate pending request", async () => {
    const owner = await createUser()
    const joiner = await createUser()
    const community = await makeCommunity(owner.token, {
      name: "Closed Doors",
      visibility: "private"
    })

    await request(app)
      .post(`/api/v1/community/${community._id}/join`)
      .set(authHeader(joiner.token))
    const second = await request(app)
      .post(`/api/v1/community/${community._id}/join`)
      .set(authHeader(joiner.token))

    expect(second.status).toBe(400)
  })

  it("blocks the last admin from leaving", async () => {
    const owner = await createUser()
    const community = await makeCommunity(owner.token, { name: "Solo Group" })

    const res = await request(app)
      .post(`/api/v1/community/${community._id}/leave`)
      .set(authHeader(owner.token))

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/admin/i)
  })

  it("lets a plain member leave and decrements the count", async () => {
    const owner = await createUser()
    const joiner = await createUser()
    const community = await makeCommunity(owner.token, { name: "Open Doors" })

    await request(app)
      .post(`/api/v1/community/${community._id}/join`)
      .set(authHeader(joiner.token))
    const res = await request(app)
      .post(`/api/v1/community/${community._id}/leave`)
      .set(authHeader(joiner.token))

    expect(res.status).toBe(202)
    const fresh = await Community.findById(community._id)
    expect(fresh.memberCount).toBe(1)
  })
})

describe("content visibility", () => {
  it("hides the member list from non-members of a PUBLIC community", async () => {
    const owner = await createUser()
    const outsider = await createUser()
    const community = await makeCommunity(owner.token, { name: "Open Doors" })

    const res = await request(app)
      .get(`/api/v1/community/${community._id}/members`)
      .set(authHeader(outsider.token))

    expect(res.status).toBe(403)
  })

  it("shows the member list to members", async () => {
    const owner = await createUser()
    const joiner = await createUser()
    const community = await makeCommunity(owner.token, { name: "Open Doors" })

    await request(app)
      .post(`/api/v1/community/${community._id}/join`)
      .set(authHeader(joiner.token))
    const res = await request(app)
      .get(`/api/v1/community/${community._id}/members`)
      .set(authHeader(joiner.token))

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
  })

  it("reports canViewContent=false to a non-member on the detail route", async () => {
    const owner = await createUser()
    const outsider = await createUser()
    const community = await makeCommunity(owner.token, { name: "Open Doors" })

    const res = await request(app)
      .get(`/api/v1/community/${community.slug}`)
      .set(authHeader(outsider.token))

    expect(res.status).toBe(200)
    expect(res.body.data.canViewContent).toBe(false)
    expect(res.body.data.name).toBe("Open Doors")
  })
})

describe("reactions", () => {
  it("likes, then clears on a repeat like", async () => {
    const owner = await createUser()
    const voter = await createUser()
    const community = await makeCommunity(owner.token, { name: "Open Doors" })

    const liked = await request(app)
      .post(`/api/v1/community/${community._id}/react`)
      .set(authHeader(voter.token))
      .send({ value: 1 })
    expect(liked.body.data.viewerReaction).toBe(1)
    expect((await Community.findById(community._id)).likeCount).toBe(1)

    const cleared = await request(app)
      .post(`/api/v1/community/${community._id}/react`)
      .set(authHeader(voter.token))
      .send({ value: 1 })
    expect(cleared.body.data.viewerReaction).toBe(0)
    expect((await Community.findById(community._id)).likeCount).toBe(0)
  })

  it("flips a like to a dislike without leaving a stale count", async () => {
    const owner = await createUser()
    const voter = await createUser()
    const community = await makeCommunity(owner.token, { name: "Open Doors" })

    await request(app)
      .post(`/api/v1/community/${community._id}/react`)
      .set(authHeader(voter.token))
      .send({ value: 1 })
    await request(app)
      .post(`/api/v1/community/${community._id}/react`)
      .set(authHeader(voter.token))
      .send({ value: -1 })

    const fresh = await Community.findById(community._id)
    expect(fresh.likeCount).toBe(0)
    expect(fresh.dislikeCount).toBe(1)
  })

  it("rejects an invalid reaction value", async () => {
    const { token } = await createUser()
    const community = await makeCommunity(token, { name: "Open Doors" })

    const res = await request(app)
      .post(`/api/v1/community/${community._id}/react`)
      .set(authHeader(token))
      .send({ value: 5 })

    expect(res.status).toBe(400)
  })

  it("blocks non-members from reacting to a private community", async () => {
    const owner = await createUser()
    const outsider = await createUser()
    const community = await makeCommunity(owner.token, {
      name: "Closed Doors",
      visibility: "private"
    })

    const res = await request(app)
      .post(`/api/v1/community/${community._id}/react`)
      .set(authHeader(outsider.token))
      .send({ value: 1 })

    expect(res.status).toBe(403)
  })
})

describe("role management", () => {
  const setupWithMember = async () => {
    const owner = await createUser()
    const member = await createUser()
    const community = await makeCommunity(owner.token, { name: "Open Doors" })
    await request(app)
      .post(`/api/v1/community/${community._id}/join`)
      .set(authHeader(member.token))
    return { owner, member, community }
  }

  it("lets an admin promote a member to moderator", async () => {
    const { owner, member, community } = await setupWithMember()

    const res = await request(app)
      .patch(`/api/v1/community/${community._id}/members/${member.user._id}`)
      .set(authHeader(owner.token))
      .send({ role: "moderator" })

    expect(res.status).toBe(202)
    expect(res.body.data.role).toBe("moderator")
  })

  it("stops a plain member from promoting anyone", async () => {
    const { member, community } = await setupWithMember()

    const res = await request(app)
      .patch(`/api/v1/community/${community._id}/members/${member.user._id}`)
      .set(authHeader(member.token))
      .send({ role: "admin" })

    expect(res.status).toBe(403)
  })

  it("stops an admin from demoting themselves", async () => {
    const { owner, community } = await setupWithMember()

    const res = await request(app)
      .patch(`/api/v1/community/${community._id}/members/${owner.user._id}`)
      .set(authHeader(owner.token))
      .send({ role: "member" })

    expect(res.status).toBe(400)
  })

  it("lets a moderator remove a plain member", async () => {
    const { owner, member, community } = await setupWithMember()
    const moderator = await createUser()
    await request(app)
      .post(`/api/v1/community/${community._id}/join`)
      .set(authHeader(moderator.token))
    await request(app)
      .patch(`/api/v1/community/${community._id}/members/${moderator.user._id}`)
      .set(authHeader(owner.token))
      .send({ role: "moderator" })

    const res = await request(app)
      .delete(`/api/v1/community/${community._id}/members/${member.user._id}`)
      .set(authHeader(moderator.token))

    expect(res.status).toBe(202)
    expect(await CommunityMember.countDocuments({ community: community._id })).toBe(2)
  })

  it("stops a moderator from removing an admin", async () => {
    const { owner, member, community } = await setupWithMember()
    await request(app)
      .patch(`/api/v1/community/${community._id}/members/${member.user._id}`)
      .set(authHeader(owner.token))
      .send({ role: "moderator" })

    const res = await request(app)
      .delete(`/api/v1/community/${community._id}/members/${owner.user._id}`)
      .set(authHeader(member.token))

    expect(res.status).toBe(403)
  })
})

describe("invites and join requests", () => {
  it("invites a user, who then sees and accepts it", async () => {
    const owner = await createUser()
    const invitee = await createUser()
    const community = await makeCommunity(owner.token, {
      name: "Closed Doors",
      visibility: "private"
    })

    const invited = await request(app)
      .post(`/api/v1/community/${community._id}/invites`)
      .set(authHeader(owner.token))
      .send({ email: invitee.user.email })
    expect(invited.status).toBe(201)

    const inbox = await request(app)
      .get("/api/v1/community/me/invitations")
      .set(authHeader(invitee.token))
    expect(inbox.body.data).toHaveLength(1)

    const accepted = await request(app)
      .post(`/api/v1/community/requests/${invited.body.data._id}/respond`)
      .set(authHeader(invitee.token))
      .send({ action: "accept" })

    expect(accepted.status).toBe(202)
    expect(accepted.body.data.status).toBe("accepted")
    expect((await Community.findById(community._id)).memberCount).toBe(2)
  })

  it("stops a third party from answering someone else's invite", async () => {
    const owner = await createUser()
    const invitee = await createUser()
    const stranger = await createUser()
    const community = await makeCommunity(owner.token, {
      name: "Closed Doors",
      visibility: "private"
    })

    const invited = await request(app)
      .post(`/api/v1/community/${community._id}/invites`)
      .set(authHeader(owner.token))
      .send({ userId: invitee.user._id.toString() })

    const res = await request(app)
      .post(`/api/v1/community/requests/${invited.body.data._id}/respond`)
      .set(authHeader(stranger.token))
      .send({ action: "accept" })

    expect(res.status).toBe(403)
  })

  it("lets a moderator approve a join request", async () => {
    const owner = await createUser()
    const joiner = await createUser()
    const community = await makeCommunity(owner.token, {
      name: "Closed Doors",
      visibility: "private"
    })

    await request(app)
      .post(`/api/v1/community/${community._id}/join`)
      .set(authHeader(joiner.token))

    const pending = await request(app)
      .get(`/api/v1/community/${community._id}/requests`)
      .set(authHeader(owner.token))
    expect(pending.body.data).toHaveLength(1)

    const approved = await request(app)
      .post(`/api/v1/community/requests/${pending.body.data[0]._id}/respond`)
      .set(authHeader(owner.token))
      .send({ action: "accept" })

    expect(approved.body.data.status).toBe("accepted")
    expect((await Community.findById(community._id)).memberCount).toBe(2)
  })

  it("does not add a member when a request is rejected", async () => {
    const owner = await createUser()
    const joiner = await createUser()
    const community = await makeCommunity(owner.token, {
      name: "Closed Doors",
      visibility: "private"
    })

    await request(app)
      .post(`/api/v1/community/${community._id}/join`)
      .set(authHeader(joiner.token))
    const pending = await request(app)
      .get(`/api/v1/community/${community._id}/requests`)
      .set(authHeader(owner.token))

    await request(app)
      .post(`/api/v1/community/requests/${pending.body.data[0]._id}/respond`)
      .set(authHeader(owner.token))
      .send({ action: "reject" })

    expect((await Community.findById(community._id)).memberCount).toBe(1)
  })

  it("refuses to resolve an already-resolved request", async () => {
    const owner = await createUser()
    const invitee = await createUser()
    const community = await makeCommunity(owner.token, {
      name: "Closed Doors",
      visibility: "private"
    })

    const invited = await request(app)
      .post(`/api/v1/community/${community._id}/invites`)
      .set(authHeader(owner.token))
      .send({ userId: invitee.user._id.toString() })

    const url = `/api/v1/community/requests/${invited.body.data._id}/respond`
    await request(app)
      .post(url)
      .set(authHeader(invitee.token))
      .send({ action: "accept" })
    const second = await request(app)
      .post(url)
      .set(authHeader(invitee.token))
      .send({ action: "accept" })

    expect(second.status).toBe(400)
  })

  it("stops a plain member from inviting", async () => {
    const owner = await createUser()
    const member = await createUser()
    const target = await createUser()
    const community = await makeCommunity(owner.token, { name: "Open Doors" })
    await request(app)
      .post(`/api/v1/community/${community._id}/join`)
      .set(authHeader(member.token))

    const res = await request(app)
      .post(`/api/v1/community/${community._id}/invites`)
      .set(authHeader(member.token))
      .send({ userId: target.user._id.toString() })

    expect(res.status).toBe(403)
  })

  it("stops a non-moderator from reading the request queue", async () => {
    const owner = await createUser()
    const outsider = await createUser()
    const community = await makeCommunity(owner.token, { name: "Open Doors" })

    const res = await request(app)
      .get(`/api/v1/community/${community._id}/requests`)
      .set(authHeader(outsider.token))

    expect(res.status).toBe(403)
  })

  it("refuses to invite an existing member", async () => {
    const owner = await createUser()
    const member = await createUser()
    const community = await makeCommunity(owner.token, { name: "Open Doors" })
    await request(app)
      .post(`/api/v1/community/${community._id}/join`)
      .set(authHeader(member.token))

    const res = await request(app)
      .post(`/api/v1/community/${community._id}/invites`)
      .set(authHeader(owner.token))
      .send({ userId: member.user._id.toString() })

    expect(res.status).toBe(400)
  })
})

describe("settings", () => {
  it("lets an admin change visibility and approval mode", async () => {
    const { token } = await createUser()
    const community = await makeCommunity(token, { name: "Open Doors" })

    const res = await request(app)
      .put(`/api/v1/community/${community._id}`)
      .set(authHeader(token))
      .send({ visibility: "private", requiresApproval: true })

    expect(res.status).toBe(202)
    const fresh = await Community.findById(community._id)
    expect(fresh.visibility).toBe("private")
    expect(fresh.requiresApproval).toBe(true)
  })

  it("stops a non-admin from changing settings", async () => {
    const owner = await createUser()
    const member = await createUser()
    const community = await makeCommunity(owner.token, { name: "Open Doors" })
    await request(app)
      .post(`/api/v1/community/${community._id}/join`)
      .set(authHeader(member.token))

    const res = await request(app)
      .put(`/api/v1/community/${community._id}`)
      .set(authHeader(member.token))
      .send({ visibility: "private" })

    expect(res.status).toBe(403)
  })

  it("stops a non-admin from deleting the community", async () => {
    const owner = await createUser()
    const outsider = await createUser()
    const community = await makeCommunity(owner.token, { name: "Open Doors" })

    const res = await request(app)
      .delete(`/api/v1/community/${community._id}`)
      .set(authHeader(outsider.token))

    expect(res.status).toBe(403)
  })
})
