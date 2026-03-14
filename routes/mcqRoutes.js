const express = require('express');
const { MCQController } = require('../controller/mcqController');
const { userAuth } = require('../middleware/userAuthMiddleware');
const router = express.Router();


router.get("/", userAuth, MCQController.getMCQs);
router.get("/analytics/summary", userAuth, MCQController.getQuestionInteractionSummary);
router.get("/:questionId/interactions", userAuth, MCQController.getQuestionInteractionDetail);
router.post("/:questionId/comments", userAuth, MCQController.addQuestionComment);
router.post("/:questionId/option-click", userAuth, MCQController.trackOptionClick);
router.get("/:questionId",userAuth, MCQController.getMCQById);
router.post("/", userAuth,MCQController.postMCQ);
router.put("/", userAuth, MCQController.updateMCQ);
router.delete("/:questionId", userAuth, MCQController.deleteMCQById);
router.patch("/", userAuth, MCQController.bookmarkQuestion);

module.exports = router;
