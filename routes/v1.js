"use strict"

const express = require("express")
const router = express.Router()

const userRoutes = require("../modules/user/index")
const mcqRoutes = require("../modules/mcq/index")
const masterRoutes = require("../modules/master/index")
const quizRoutes = require("../modules/quiz/index")
const performanceRoutes = require("../modules/performance/index")

// API health check
router.get("/", (req, res) => {
  res.json({ status: "ok", message: "QMark API v1 is healthy" })
})

// Module routes
router.use("/user", userRoutes)
router.use("/mcq", mcqRoutes)
router.use("/master", masterRoutes)
router.use("/quiz", quizRoutes)
router.use("/performance", performanceRoutes)

module.exports = router
