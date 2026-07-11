"use strict"

class CustomError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.status = statusCode >= 400 && statusCode < 500 ? "failed" : "error"
    this.statusCode = statusCode
    this.message = message
  }
}

module.exports = CustomError
