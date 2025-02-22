const asyncErrorHandler = require("../middleware/asyncErrorHandler");
const { mcqService } = require("../service/mcqService");
const { successResponse } = require("../utility/successResponse");

const MCQController = {
    getMCQs: asyncErrorHandler(async (req, res) => {
        const response = await mcqService.getMCQs(req.query);
        res.status(200).json(successResponse(200, response, "Questions sent successfully"));
    }),

    getMCQById: asyncErrorHandler(async (req, res) => {
        const response = await mcqService.getMCQById(req.params);
        res.status(200).json(successResponse(200, response, "Question sent successfully"));
    }),
    deleteMCQById: asyncErrorHandler(async (req, res) => {
        
        const response = await mcqService.deleteMCQById(req.params);
        res.status(202).json(successResponse(202, response, "Question deleted successfully"));
    }),

    postMCQ: asyncErrorHandler(async (req, res) => {
        const response = await mcqService.postMCQs(req.body);
        
        res.status(201).json(successResponse(201, response, "Question saved successfully"));
    }),

    updateMCQ: asyncErrorHandler(async (req, res) => {
        const response = await mcqService.updateMCQ(req.body);
        
        res.status(202).json(successResponse(202, response, "Question updated successfully"));
    }),
}


module.exports = { MCQController };