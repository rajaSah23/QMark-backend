"use strict"

const Joi = require("joi")

/**
 * Schema for endpoints requiring a date range (startDate + endDate).
 */
const dateRangeSchema = Joi.object({
  startDate: Joi.string().isoDate().required().messages({
    "any.required": "startDate is required",
    "string.isoDate": "startDate must be a valid ISO date (YYYY-MM-DD)"
  }),
  endDate: Joi.string().isoDate().required().messages({
    "any.required": "endDate is required",
    "string.isoDate": "endDate must be a valid ISO date (YYYY-MM-DD)"
  })
})

module.exports = { dateRangeSchema }
