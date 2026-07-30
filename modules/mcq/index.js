"use strict"

const express = require("express")
const router = express.Router()
const controller = require("./controller")
const asyncHandler = require("../../middlewares/asyncHandler")
const { userAuth } = require("../../middlewares/auth")

// All MCQ routes require authentication
router.use(userAuth)

router.get("/", asyncHandler(controller.getMCQs))
router.get("/review-queue", asyncHandler(controller.getReviewQueue))
router.get("/analytics/summary", asyncHandler(controller.getQuestionInteractionSummary))
router.get("/:questionId/interactions", asyncHandler(controller.getQuestionInteractionDetail))
router.post("/:questionId/comments", asyncHandler(controller.addQuestionComment))
router.post("/:questionId/option-click", asyncHandler(controller.trackOptionClick))
router.get("/:questionId", asyncHandler(controller.getMCQById))
router.post("/", asyncHandler(controller.postMCQ))
router.put("/", asyncHandler(controller.updateMCQ))
router.delete("/:questionId", asyncHandler(controller.deleteMCQById))
router.patch("/", asyncHandler(controller.bookmarkQuestion))

module.exports = router
