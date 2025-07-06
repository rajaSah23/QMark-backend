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
    getTopics = async (req, res) => {
        const response = await masterService.getTopicList(req.user.id,req.params.subjectId);

        res.status(200).json(successResponse(200, response, "Topic list sent"))
    }

}

module.exports = new MasterController();