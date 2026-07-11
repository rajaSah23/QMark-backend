"use strict"

const User = require("./userModel")
const Token = require("./tokenModel")

// ─── User CRUD ────────────────────────────────────────────────────────────────

const createUser = (userData) => User.create(userData)

const findByEmail = (email) => User.findOne({ email })

const findById = (userId) => User.findById(userId)

const updateUserById = (userId, data) =>
  User.findByIdAndUpdate(userId, data, { new: true })

// ─── Token CRUD ───────────────────────────────────────────────────────────────

const findToken = (condition) => Token.findOne(condition)

const updateOrCreateToken = (userId, data) =>
  Token.findOneAndUpdate({ userId }, { $set: data }, { new: true, upsert: true })

const deleteToken = (id) => Token.findByIdAndDelete(id)

module.exports = {
  createUser,
  findByEmail,
  findById,
  updateUserById,
  findToken,
  updateOrCreateToken,
  deleteToken
}
