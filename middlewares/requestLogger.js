"use strict"

/**
 * Logs every incoming request with timestamp, method and URL.
 * Also sets a custom response header.
 */
const requestLogger = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`)
  res.set("X-Powered-By", "QMark Server")
  next()
}

module.exports = requestLogger
