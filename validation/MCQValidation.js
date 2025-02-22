// validation/mcqValidation.js
const Joi = require('joi');

const createMCQSchema = Joi.object({
  question: Joi.string().required().messages({
    'any.required': 'Question is required',
    'string.empty': 'Question cannot be empty'
  }),
  options: Joi.array().items(Joi.string().min(1))
    .min(2).required()
    .messages({
      'array.base': 'Options must be an array',
      'array.min': 'At least 2 options required',
      'any.required': 'Options are required'
    }),
  correctAnswer: Joi.string().required().custom((value, helpers) => {
    const options = helpers.state.ancestors[0].options;
    if (!options.includes(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).messages({
    'any.required': 'Correct answer is required',
    'any.invalid': 'Correct answer must match one of the options'
  }),
  difficulty: Joi.string().valid('easy', 'medium', 'hard').required()
    .messages({
      'any.only': 'Difficulty must be easy, medium, or hard'
    }),
  subject: Joi.string().allow(''),
  tag: Joi.array().items(Joi.string()),
  explanation: Joi.string().allow(''),
  status: Joi.boolean().default(true)
});

const updateMCQSchema = Joi.object({
  question: Joi.string(),
  options: Joi.array().items(Joi.string().min(1)).min(2),
  correctAnswer: Joi.string().custom((value, helpers) => {
    const options = helpers.state.ancestors[0].options;
    if (options && !options.includes(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }),
  difficulty: Joi.string().valid('easy', 'medium', 'hard'),
  subject: Joi.string().allow(''),
  tag: Joi.array().items(Joi.string()),
  explanation: Joi.string().allow(''),
  status: Joi.boolean()
}).min(1);

module.exports = {
  createMCQSchema,
  updateMCQSchema
};