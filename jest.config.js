"use strict"

module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  testTimeout: 30000,
  clearMocks: true,
  // Each suite boots its own in-process MongoDB. Running suites in parallel
  // makes several mongod instances contend on startup and intermittently fail
  // to connect, so serialise here rather than relying on the npm script's
  // --runInBand (which `npx jest` would bypass).
  maxWorkers: 1
}
