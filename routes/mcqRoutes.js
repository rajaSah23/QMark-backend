const express = require('express');
const { MCQController } = require('../controller/mcqController');
const { userAuth } = require('../middleware/userAuthMiddleware');
const router = express.Router();


router.get("/", userAuth, MCQController.getMCQs);
router.get("/:questionId", MCQController.getMCQById);
router.post("/", MCQController.postMCQ);
router.put("/", MCQController.updateMCQ);
router.delete("/:questionId", MCQController.deleteMCQById);

module.exports = router;