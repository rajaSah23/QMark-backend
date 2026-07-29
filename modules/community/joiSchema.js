"use strict"

const Joi = require("joi")

const objectId = Joi.string().hex().length(24)

const createCommunitySchema = Joi.object({
  name: Joi.string().trim().min(3).max(80).required(),
  description: Joi.string().trim().allow("").max(1000).default(""),
  visibility: Joi.string().valid("public", "private").default("public"),
  requiresApproval: Joi.boolean().default(false),
  subjects: Joi.array().items(objectId).default([])
})

const updateCommunitySchema = Joi.object({
  name: Joi.string().trim().min(3).max(80),
  description: Joi.string().trim().allow("").max(1000),
  visibility: Joi.string().valid("public", "private"),
  requiresApproval: Joi.boolean(),
  subjects: Joi.array().items(objectId)
}).min(1)

const reactSchema = Joi.object({
  value: Joi.number().valid(1, -1).required()
})

const inviteSchema = Joi.object({
  userId: objectId,
  email: Joi.string().email()
}).xor("userId", "email")

const respondSchema = Joi.object({
  action: Joi.string().valid("accept", "reject").required()
})

const changeRoleSchema = Joi.object({
  role: Joi.string().valid("admin", "moderator", "member").required()
})

module.exports = {
  createCommunitySchema,
  updateCommunitySchema,
  reactSchema,
  inviteSchema,
  respondSchema,
  changeRoleSchema
}
