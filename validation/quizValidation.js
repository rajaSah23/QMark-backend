const Joi = require('joi');

const createQuizSchema = Joi.object({
    title: Joi.string().trim().required().messages({
        'any.required': 'Quiz title is required',
        'string.empty': 'Quiz title cannot be empty'
    }),
    description: Joi.string().allow('').default(''),
    // Provide specific question IDs or let filters pick them
    questionIds: Joi.array().items(Joi.string()).default([]),
    // Optional filters to auto-select questions
    filters: Joi.object({
        subject: Joi.string().allow(''),
        topic: Joi.string().allow(''),
        difficulty: Joi.string().valid('easy', 'medium', 'hard').allow(''),
        tags: Joi.array().items(Joi.string()).default([]),
        limit: Joi.number().integer().min(1).max(100).default(10)
    }).default({}),
    settings: Joi.object({
        shuffleQuestions: Joi.boolean().default(false),
        shuffleOptions: Joi.boolean().default(false),
        timeLimit: Joi.number().integer().min(0).default(0)
    }).default({})
});

const updateQuizSchema = Joi.object({
    title: Joi.string().trim(),
    description: Joi.string().allow(''),
    questionIds: Joi.array().items(Joi.string()),
    settings: Joi.object({
        shuffleQuestions: Joi.boolean(),
        shuffleOptions: Joi.boolean(),
        timeLimit: Joi.number().integer().min(0)
    })
}).min(1);

const submitAttemptSchema = Joi.object({
    answers: Joi.array().items(
        Joi.object({
            question: Joi.string().required(),
            selectedAnswer: Joi.string().allow(null, '').default(null),
            status: Joi.string().valid('not_answered', 'answered', 'marked_for_review').default('not_answered'),
            markedForReview: Joi.boolean().default(false),
            visited: Joi.boolean().default(false)
        })
    ).required().messages({
        'any.required': 'Answers array is required'
    }),
    timeTaken: Joi.number().integer().min(0).default(0)
});

module.exports = { createQuizSchema, updateQuizSchema, submitAttemptSchema };
