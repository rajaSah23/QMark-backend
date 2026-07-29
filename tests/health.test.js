"use strict"

const request = require("supertest")
const mongoose = require("mongoose")
const app = require("../app")
const { createUser, authHeader } = require("./helpers/factories")

describe("test harness", () => {
  it("serves the v1 health endpoint", async () => {
    const res = await request(app).get("/api/v1/")
    expect(res.status).toBe(200)
    expect(res.body.status).toBe("ok")
  })

  it("is connected to an in-memory database, not Atlas", () => {
    expect(mongoose.connection.readyState).toBe(1)
    expect(mongoose.connection.host).toMatch(/127\.0\.0\.1|localhost/)
  })

  it("can create an authenticated user via the factory", async () => {
    const { user, token } = await createUser()
    expect(token).toEqual(expect.any(String))

    const res = await request(app).get("/api/v1/mcq").set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.data.results).toEqual([])
    expect(user.email).toMatch(/@test\.com$/)
  })
})
