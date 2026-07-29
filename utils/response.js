"use strict"

/**
 * Formats a successful API response.
 * @param {number} statusCode
 * @param {*} data
 * @param {string} message
 */
const successResponse = (statusCode, data, message) => {
  return {
    statusCode: statusCode || 200,
    data: data || null,
    message: message || "Data sent successfully"
  }
}

/**
 * Sends an error response. Reads statusCode and message from the error object.
 * @param {import("express").Response} res
 * @param {Error} error
 */
const errorResponse = (res, error) => {
  // Tests deliberately exercise 4xx paths; logging them would drown the output.
  if (process.env.NODE_ENV !== "test") {
    console.error(error.message)
  }
  res.status(error.statusCode || 500).json({
    statusCode: error.statusCode || 500,
    message: error.message || "Something went wrong",
    timestamp: new Date()
  })
}

module.exports = { successResponse, errorResponse }
