"use strict"

const express = require("express")
const cors = require("cors")
const v1Router = require("./routes/v1")
const requestLogger = require("./middlewares/requestLogger")

const app = express()

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(express.json())
app.use(cors())
app.use(requestLogger)

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/v1", v1Router)

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "QMark API is running" })
})

module.exports = app
