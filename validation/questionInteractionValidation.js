const Joi = require("joi");

const trackQuestionInteractionSchema = Joi.object({
    selectedAnswer: Joi.string().trim().required().messages({
        "any.required": "Selected answer is required",
        "string.empty": "Selected answer is required"
    })
});

module.exports = { trackQuestionInteractionSchema };
