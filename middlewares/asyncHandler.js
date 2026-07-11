"use strict"

const { errorResponse } = require("../utils/response")

/**
 * Wraps an async route handler and forwards any errors to the error response utility.
 * Usage: router.get("/path", asyncHandler(controller.method))
 * @param {Function} func - async Express handler
 * @returns {Function}
 */
const asyncHandler = (func) => {
  return (req, res, next) => {
    func(req, res, next).catch((err) => errorResponse(res, err))
  }
}

module.exports = asyncHandler
