"use strict"

/**
 * Logs every incoming request with timestamp, method and URL.
 * Also sets a custom response header. Stays silent under test so
 * test output remains pristine.
 */
const requestLogger = (req, res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`)
  }
  res.set("X-Powered-By", "QMark Server")
  next()
}

module.exports = requestLogger
