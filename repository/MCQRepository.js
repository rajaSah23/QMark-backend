const MCQ = require("../db/model/MCQModel");
const CustomError = require("../utility/CustomError");
const { createMCQSchema } = require("../validation/MCQValidation");

const MCQRepository = {
    aggregateMCQs: async (pipeline) => {
        const results = await MCQ.aggregate(pipeline);
        return results;
    },
    getMCQById: async (questionId) => {
        const response = await MCQ.findById(questionId);
        if (!response) throw new CustomError(404, "Question not found");
        return response;
    },
    getQuestion: async (condition) => {
        return await MCQ.findOne(condition);
    },
    deleteMCQById: async (questionId) => {
        const response = await MCQ.findByIdAndDelete(questionId);
        if (!response) throw new CustomError(404, "Question not found");
        return response;
    },
    postMCQs: async (data) => {
        const { error } = createMCQSchema.validate(data);
        if (error) throw new CustomError(400, error.details[0].message);
        // create and populate subject and topic
        const mcq = await MCQ.create(data);
        const response = await MCQ.findById(mcq._id).populate("subject").populate("topic");
        return response;
    },
    updateMCQ: async (questionId, data) => {
        const response = await MCQ.findByIdAndUpdate(questionId, data, { new: true })
            .populate("subject")
            .populate("topic");
        if (!response) throw new CustomError(404, "Question not found");
        return response;
    },
};

module.exports = MCQRepository;