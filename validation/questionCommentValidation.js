const Joi = require("joi");

const addQuestionCommentSchema = Joi.object({
    comment: Joi.string().trim().min(1).max(1000).required().messages({
        "any.required": "Comment is required",
        "string.empty": "Comment is required"
    })
});

module.exports = { addQuestionCommentSchema };
