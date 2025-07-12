const { default: mongoose } = require("mongoose");
const MCQRepository = require("../repository/MCQRepository");
const CustomError = require("../utility/CustomError");

const mcqService = {
    getMCQs: async (userId, query) => {
        console.log(userId, query);

        const matchStage = {};

        // Text search
        if (query?.search) {
            const searchRegex = new RegExp(query.search, 'i');
            matchStage.$or = [
                { question: searchRegex },
                { tag: searchRegex }
            ];
        }
        //Match bookmark
        if (query?.bookmark) {
            matchStage.bookmark = query.bookmark === 'true';
        }

        // Match subject by ObjectId
        if (query?.subject && query.subject !== 'all') {
            try {
                matchStage.subject = new mongoose.Types.ObjectId(query.subject);
            } catch (err) {
                console.warn("Invalid subject ID:", query.subject);
            }
        }

        // Match topic by ObjectId
        if (query?.topic && query.topic !== 'other') {
            try {
                matchStage.topic = new mongoose.Types.ObjectId(query.topic);
            } catch (err) {
                console.warn("Invalid topic ID:", query.topic);
            }
        }

        // Match difficulty
        if (query?.difficulty) {
            matchStage.difficulty = query.difficulty;
        }

        // Match status
        if (query?.status) {
            matchStage.status = query.status === 'true';
        }

        // Match by user
        if (userId) {
            matchStage.user = new mongoose.Types.ObjectId(userId);
        }

        // Total count
        const countPipeline = [
            { $match: matchStage },
            { $count: "total" }
        ];
        const countResult = await MCQRepository.aggregateMCQs(countPipeline);
        const total = countResult[0]?.total || 0;

        // Pagination
        const page = parseInt(query?.page) || 1;
        const limit = parseInt(query?.limit) || 10;
        const skip = (page - 1) * limit;
        const sortOrder = query?.sort === "ASC" ? 1 : -1;

        // Results query
        const aggPipeline = [
            { $match: matchStage },
            { $sort: { createdAt: sortOrder } },
            { $skip: skip },
            { $limit: limit },
            // Optional: populate subject and topic data
            {
                $lookup: {
                    from: 'subjects',
                    localField: 'subject',
                    foreignField: '_id',
                    as: 'subject'
                }
            },
            {
                $unwind: {
                    path: '$subject',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'topics',
                    localField: 'topic',
                    foreignField: '_id',
                    as: 'topic'
                }
            },
            {
                $unwind: {
                    path: '$topic',
                    preserveNullAndEmptyArrays: true
                }
            }
        ];

        const results = await MCQRepository.aggregateMCQs(aggPipeline);

        return {
            results,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    },

    getMCQById: async (userId, params) => {
        if (!userId) throw new CustomError(400, "User ID is required");

        const mcq = await MCQRepository.getMCQById(params.questionId);
        if (!mcq) throw new CustomError(404, "Question not found");

        if (!mcq.user || mcq.user.toString() !== userId) throw new CustomError(403, "You are not authorized to access this question");

        const response = await MCQRepository.getMCQById(params.questionId);
        return response;
    },
    deleteMCQById: async (userId, params) => {
        if (!userId) throw new CustomError(400, "User ID is required");

        const mcq = await MCQRepository.getMCQById(params.questionId);
        if (!mcq) throw new CustomError(404, "Question not found");

        if (mcq.user.toString() !== userId) throw new CustomError(403, "You are not authorized to delete this question");

        const response = await MCQRepository.deleteMCQById(params.questionId);
        return response;
    },
    postMCQs: async (userId, body) => {
        if (!userId) throw new CustomError(400, "User ID is required");
        const data = {}
        data.user = userId;
        if (body.question) data.question = body.question
        if (body.options) data.options = body.options
        if (body.correctAnswer) data.correctAnswer = body.correctAnswer
        if (body.difficulty) data.difficulty = body.difficulty
        if (body.tag) data.tag = body.tag
        if (body.subject) data.subject = body.subject
        if (body.topic) data.topic = body.topic
        if (body.explanation) data.explanation = body.explanation
        if (body.status) data.status = body.status
        console.log(data);

        const response = await MCQRepository.postMCQs(data);
        return response;
    },
    updateMCQ: async (userId, body) => {
        if (!userId) throw new CustomError(400, "User ID is required");

        const mcq = await MCQRepository.getMCQById(body.questionId);
        if (!mcq) throw new CustomError(404, "Question not found");
        if (mcq.user.toString() !== userId) throw new CustomError(403, "You are not authorized to update this question");

        const questionId = body.questionId;
        const data = {}
        if (body.question) data.question = body.question
        if (body.options) data.options = body.options
        if (body.tag) data.tag = body.tag
        if (body.correctAnswer) data.correctAnswer = body.correctAnswer
        if (body.difficulty) data.difficulty = body.difficulty
        if (body.subject) data.subject = body.subject
        if (body.explanation) data.explanation = body.explanation
        if (body.status) data.status = body.status


        const response = await MCQRepository.updateMCQ(questionId, data);
        return response;
    },
    bookmarkQuestion: async (userId, body) => {
        if (!userId) throw new CustomError(400, "User ID is required");

        const mcq = await MCQRepository.getQuestion({_id: body.questionId, user:userId});
        if (!mcq) throw new CustomError(404, "Question not found");

        const newData = {
            bookmark:body.bookmark
        }
        
        const response = await MCQRepository.updateMCQ(body.questionId, newData);
        return response;
    },
}

module.exports = { mcqService };