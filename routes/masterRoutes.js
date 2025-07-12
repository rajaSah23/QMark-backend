const express = require('express');
const { userAuth } = require('../middleware/userAuthMiddleware');
const masterController = require('../controller/masterController');
const asyncErrorHandler = require('../middleware/asyncErrorHandler');
const router = express.Router();


router.get("/subjects", userAuth, asyncErrorHandler(masterController.getSubject));
router.delete("/subject/:subjectId", userAuth, asyncErrorHandler(masterController.deleteSubject));
router.delete("/topic/:topicId", userAuth, asyncErrorHandler(masterController.deleteTopic));
router.put("/subject/:subjectId", userAuth, asyncErrorHandler(masterController.updateSubject));
router.get("/topics/:subjectId", userAuth, asyncErrorHandler(masterController.getTopics));
router.put("/topic/:topicId", userAuth, asyncErrorHandler(masterController.updateTopic));
router.post("/subject-topics", userAuth, asyncErrorHandler(masterController.addSubjectAndTopics));
router.post("/topic", userAuth, asyncErrorHandler(masterController.addTopic));

module.exports = router;