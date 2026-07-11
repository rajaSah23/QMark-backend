"use strict"

const express = require("express")
const router = express.Router()
const controller = require("./controller")
const asyncHandler = require("../../middlewares/asyncHandler")
const { userAuth } = require("../../middlewares/auth")

// All master routes require authentication
router.use(userAuth)

router.get("/subjects", asyncHandler(controller.getSubject))
router.delete("/subject/:subjectId", asyncHandler(controller.deleteSubject))
router.delete("/topic/:topicId", asyncHandler(controller.deleteTopic))
router.put("/subject/:subjectId", asyncHandler(controller.updateSubject))
router.get("/topics/:subjectId", asyncHandler(controller.getTopics))
router.put("/topic/:topicId", asyncHandler(controller.updateTopic))
router.post("/subject-topics", asyncHandler(controller.addSubjectAndTopics))
router.post("/subject", asyncHandler(controller.addSubject))
router.post("/topic", asyncHandler(controller.addTopic))

module.exports = router
