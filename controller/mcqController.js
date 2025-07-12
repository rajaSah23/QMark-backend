const asyncErrorHandler = require("../middleware/asyncErrorHandler");
const { mcqService } = require("../service/mcqService");
const { successResponse } = require("../utility/successResponse");

const MCQController = {
    getMCQs: asyncErrorHandler(async (req, res) => {
        console.log("getMCQs");
        
        const response = await mcqService.getMCQs(req.user.id,req.query);
        res.status(200).json(successResponse(200, response, "Questions sent successfully"));
    }),

    getMCQById: asyncErrorHandler(async (req, res) => {
        const response = await mcqService.getMCQById(req.user.id,req.params);
        res.status(200).json(successResponse(200, response, "Question sent successfully"));
    }),
    deleteMCQById: asyncErrorHandler(async (req, res) => {
        console.log("user",req.user.id);
        
        const response = await mcqService.deleteMCQById(req.user.id,req.params);
        res.status(202).json(successResponse(202, response, "Question deleted successfully"));
    }),

    postMCQ: asyncErrorHandler(async (req, res) => {
        const response = await mcqService.postMCQs(req.user.id,req.body);
        
        res.status(201).json(successResponse(201, response, "Question saved successfully"));
    }),

    updateMCQ: asyncErrorHandler(async (req, res) => {
        const response = await mcqService.updateMCQ(req.user.id, req.body);
        
        res.status(202).json(successResponse(202, response, "Question updated successfully"));
    }),

    bookmarkQuestion: asyncErrorHandler(async (req, res) => {
        const response = await mcqService.bookmarkQuestion(req.user.id, req.body);
        
        res.status(202).json(successResponse(202, response, "Question added to bookmarks"));
    }),
}


module.exports = { MCQController };