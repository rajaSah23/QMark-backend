"use strict"

const User = require("../../modules/user/userModel")
const MCQ = require("../../modules/mcq/model")
const { generateToken } = require("../../utils/generateToken")

let counter = 0

const createUser = async (overrides = {}) => {
  counter += 1
  const user = await User.create({
    name: overrides.name || `User ${counter}`,
    email: overrides.email || `user${counter}@test.com`,
    password: overrides.password || "password123",
    isVerified: true,
    active: overrides.active !== undefined ? overrides.active : true
  })
  return { user, token: generateToken(user._id.toString()) }
}

const createQuestion = async (ownerId, overrides = {}) => {
  return await MCQ.create({
    user: ownerId,
    question: overrides.question || "What is 2 + 2?",
    options: overrides.options || ["3", "4", "5", "6"],
    correctAnswer: overrides.correctAnswer || "4",
    difficulty: overrides.difficulty || "easy",
    explanation: overrides.explanation || "Basic arithmetic.",
    ...overrides
  })
}

const authHeader = (token) => ({ Authorization: `Bearer ${token}` })

module.exports = { createUser, createQuestion, authHeader }
