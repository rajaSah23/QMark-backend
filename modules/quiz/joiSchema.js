"use strict"

const Joi = require("joi")

const createQuizSchema = Joi.object({
  title: Joi.string().trim().required().messages({
    "any.required": "Quiz title is required",
    "string.empty": "Quiz title cannot be empty"
  }),
  description: Joi.string().allow("").default(""),
  subject: Joi.string().allow(null, "").default(null),
  communityId: Joi.string().allow(null, "").default(null),
  /**
   * Personal quizzes only — a community quiz is always exam-style regardless
   * of this flag (see modules/quiz/model.js). One attempt per user, plus a
   * server-enforced time cutoff if settings.timeLimit is set.
   */
  examMode: Joi.boolean().default(false),
  questionIds: Joi.array().items(Joi.string()).default([]),
  filters: Joi.object({
    subject: Joi.string().allow(""),
    topic: Joi.string().allow(""),
    difficulty: Joi.string().valid("easy", "medium", "hard").allow(""),
    tags: Joi.array().items(Joi.string()).default([]),
    limit: Joi.number().integer().min(1).max(100).default(10),
    /**
     * Personal quizzes only (ignored for community quizzes — a shared quiz
     * can't be biased toward one member's weak areas). When true, question
     * selection is weighted toward subjects with lower accuracy and, within
     * each subject, toward a difficulty mix shaped by accuracy there —
     * instead of the plain random sample used when this is false/omitted.
     */
    adaptive: Joi.boolean().default(false)
  }).default({}),
  settings: Joi.object({
    shuffleQuestions: Joi.boolean().default(false),
    shuffleOptions: Joi.boolean().default(false),
    timeLimit: Joi.number().integer().min(0).default(0)
  }).default({})
})

const updateQuizSchema = Joi.object({
  title: Joi.string().trim(),
  description: Joi.string().allow(""),
  subject: Joi.string().allow(null, ""),
  questionIds: Joi.array().items(Joi.string()),
  active: Joi.boolean(),
  examMode: Joi.boolean(),
  settings: Joi.object({
    shuffleQuestions: Joi.boolean(),
    shuffleOptions: Joi.boolean(),
    timeLimit: Joi.number().integer().min(0)
  })
}).min(1)

const submitAttemptSchema = Joi.object({
  answers: Joi.array()
    .items(
      Joi.object({
        question: Joi.string().required(),
        selectedAnswer: Joi.string().allow(null, "").default(null),
        status: Joi.string()
          .valid("not_answered", "answered", "marked_for_review")
          .default("not_answered"),
        markedForReview: Joi.boolean().default(false),
        visited: Joi.boolean().default(false)
      })
    )
    .required()
    .messages({ "any.required": "Answers array is required" }),
  timeTaken: Joi.number().integer().min(0).default(0)
})

module.exports = { createQuizSchema, updateQuizSchema, submitAttemptSchema }
