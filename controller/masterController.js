const masterService = require("../service/masterService");
const { successResponse } = require("../utility/successResponse");

class MasterController {
    addSubjectAndTopics = async (req, res) => {
        const response = await masterService.createSubjectAndTopic(req.user.id,req.body);

        res.status(201).json(successResponse(201, response, "Subject added"))
    }
    getSubject = async (req, res) => {
        const response = await masterService.getSubjectList(req.user.id);

        res.status(200).json(successResponse(200, response, "Subject list sent"))
    }
    deleteSubject = async (req, res) => {
        const response = await masterService.deleteSubjectById(req.params.subjectId);

        res.status(200).json(successResponse(200, response, "Subject  deleted"))
    }
    deleteTopic = async (req, res) => {
        const response = await masterService.deleteTopicById(req.params.topicId);

        res.status(200).json(successResponse(200, response, "Topic deleted"));
    }
    updateSubject = async (req, res) => {
        const response = await masterService.updateSubjectById(req.user.id,req.params.subjectId,req.body);

        res.status(202).json(successResponse(202, response, "Subject  Updated"))
    }
    getTopics = async (req, res) => {
        const response = await masterService.getTopicList(req.user.id,req.params.subjectId);

        res.status(200).json(successResponse(200, response, "Topic list sent"))
    }
    updateTopic = async (req, res) => {
        const response = await masterService.updateTopicById(req.params.topicId,req.body);

        res.status(202).json(successResponse(202, response, "Topic Updated"))
    }

}

module.exports = new MasterController();