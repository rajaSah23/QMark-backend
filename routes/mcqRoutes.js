const express = require('express');
const { MCQController } = require('../controller/mcqController');
const { userAuth } = require('../middleware/userAuthMiddleware');
const router = express.Router();


router.get("/", userAuth, MCQController.getMCQs);
router.get("/:questionId",userAuth, MCQController.getMCQById);
router.post("/", userAuth,MCQController.postMCQ);
router.put("/", userAuth, MCQController.updateMCQ);
router.delete("/:questionId", userAuth, MCQController.deleteMCQById);

module.exports = router;