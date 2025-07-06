const express = require('express');
const { userAuth } = require('../middleware/userAuthMiddleware');
const masterController = require('../controller/masterController');
const asyncErrorHandler = require('../middleware/asyncErrorHandler');
const router = express.Router();


router.get("/subjects", userAuth, asyncErrorHandler(masterController.getSubject));
router.get("/topics/:subjectId", userAuth, asyncErrorHandler(masterController.getTopics));
// router.get("/:questionId",userAuth, MCQController.getMCQById);
router.post("/subject-topics", userAuth,asyncErrorHandler(masterController.addSubjectAndTopics));
// router.put("/", userAuth, MCQController.updateMCQ);
// router.delete("/:questionId", userAuth, MCQController.deleteMCQById);

module.exports = router;