"use strict"

const mongoose = require("mongoose")
const { MongoMemoryServer } = require("mongodb-memory-server")

// Guard: tests must never reach the real cluster.
process.env.NODE_ENV = "test"
process.env.JWT_SECRET = "test-secret"
delete process.env.MONGODB_URI

let mongoServer

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
})

afterEach(async () => {
  const collections = await mongoose.connection.db.collections()
  for (const collection of collections) {
    await collection.deleteMany({})
  }
})

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})
