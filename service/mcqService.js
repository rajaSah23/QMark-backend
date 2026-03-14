const { default: mongoose } = require("mongoose");
const MCQ = require("../db/model/MCQModel");
const QuestionOptionClick = require("../db/model/QuestionOptionClick");
const MCQRepository = require("../repository/MCQRepository");
const CustomError = require("../utility/CustomError");
const activityService = require("./activityService");
const { addQuestionCommentSchema } = require("../validation/questionCommentValidation");
const { trackQuestionInteractionSchema } = require("../validation/questionInteractionValidation");

const buildQuestionMatchStage = (userId, query = {}) => {
    const matchStage = {};

    if (query?.search) {
        const searchRegex = new RegExp(query.search, 'i');
        matchStage.$or = [
            { question: searchRegex },
            { tag: searchRegex },
            { options: searchRegex }
        ];
    }

    if (query?.bookmark) {
        matchStage.bookmark = query.bookmark === 'true';
    }

    if (query?.subject && query.subject !== 'all') {
        try {
            matchStage.subject = new mongoose.Types.ObjectId(query.subject);
        } catch (err) {
            console.warn("Invalid subject ID:", query.subject);
        }
    }

    if (query?.topic && query.topic !== 'other') {
        try {
            matchStage.topic = new mongoose.Types.ObjectId(query.topic);
        } catch (err) {
            console.warn("Invalid topic ID:", query.topic);
        }
    }

    if (query?.difficulty) {
        matchStage.difficulty = query.difficulty;
    }

    if (query?.status) {
        matchStage.status = query.status === 'true';
    }

    if (userId) {
        matchStage.user = new mongoose.Types.ObjectId(userId);
    }

    return matchStage;
};

const getInteractionStatsByQuestion = async (userId, questionIds = []) => {
    if (!userId || questionIds.length === 0) return {};

    const response = await QuestionOptionClick.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId),
                question: { $in: questionIds.map((id) => new mongoose.Types.ObjectId(id)) }
            }
        },
        {
            $group: {
                _id: "$question",
                totalClicks: { $sum: 1 },
                correctClicks: {
                    $sum: { $cond: ["$isCorrect", 1, 0] }
                },
                incorrectClicks: {
                    $sum: { $cond: ["$isCorrect", 0, 1] }
                },
                lastClickedAt: { $max: "$createdAt" }
            }
        }
    ]);

    return response.reduce((acc, item) => {
        const totalClicks = item.totalClicks || 0;
        acc[item._id.toString()] = {
            totalClicks,
            correctClicks: item.correctClicks || 0,
            incorrectClicks: item.incorrectClicks || 0,
            accuracy: totalClicks > 0 ? Math.round(((item.correctClicks || 0) / totalClicks) * 100) : 0,
            lastClickedAt: item.lastClickedAt || null
        };
        return acc;
    }, {});
};

const buildCreatedAtFilter = (query = {}) => {
    if (!query?.startDate && !query?.endDate) return null;

    const createdAt = {};
    if (query?.startDate) {
        const start = new Date(query.startDate);
        if (!Number.isNaN(start.getTime())) {
            createdAt.$gte = start;
        }
    }

    if (query?.endDate) {
        const end = new Date(query.endDate);
        if (!Number.isNaN(end.getTime())) {
            end.setHours(23, 59, 59, 999);
            createdAt.$lte = end;
        }
    }

    return Object.keys(createdAt).length > 0 ? createdAt : null;
};

const buildQuestionSortStages = (query = {}) => {
    const sortBy = ["random", "name", "date"].includes(query?.sortBy) ? query.sortBy : "date";
    const sortDirection = query?.sortDirection === "asc" ? 1 : -1;

    if (sortBy === "name") {
        return {
            stages: [{ $sort: { question: sortDirection, _id: 1 } }],
            meta: { sortBy, sortDirection: sortDirection === 1 ? "asc" : "desc", randomSeed: null }
        };
    }

    if (sortBy === "date") {
        return {
            stages: [{ $sort: { createdAt: sortDirection, _id: 1 } }],
            meta: { sortBy, sortDirection: sortDirection === 1 ? "asc" : "desc", randomSeed: null }
        };
    }

    const parsedSeed = parseInt(query?.randomSeed, 10);
    const randomSeed = Number.isFinite(parsedSeed) ? parsedSeed : Date.now();
    const randomMultiplier = (Math.abs(randomSeed) % 997) + 37;
    const randomOffset = (Math.abs(randomSeed) % 1543) + 101;

    return {
        stages: [
            {
                $addFields: {
                    randomOrderKey: {
                        $mod: [
                            {
                                $add: [
                                    { $multiply: [{ $toLong: "$createdAt" }, randomMultiplier] },
                                    randomOffset
                                ]
                            },
                            2147483647
                        ]
                    }
                }
            },
            { $sort: { randomOrderKey: 1, _id: 1 } }
        ],
        meta: { sortBy, sortDirection: "asc", randomSeed }
    };
};

const mcqService = {
    getMCQs: async (userId, query) => {
        const matchStage = buildQuestionMatchStage(userId, query);

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
        const { stages: sortStages, meta: sortMeta } = buildQuestionSortStages(query);

        // Results query
        const aggPipeline = [
            { $match: matchStage },
            ...sortStages,
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
        const interactionStats = await getInteractionStatsByQuestion(
            userId,
            results.map((item) => item._id.toString())
        );
        const resultsWithAnalytics = results.map((item) => ({
            ...item,
            interactionStats: interactionStats[item._id.toString()] || {
                totalClicks: 0,
                correctClicks: 0,
                incorrectClicks: 0,
                accuracy: 0,
                lastClickedAt: null
            }
        }));

        return {
            results: resultsWithAnalytics,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            sortBy: sortMeta.sortBy,
            sortDirection: sortMeta.sortDirection,
            randomSeed: sortMeta.randomSeed,
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
        
        // Log activity
        await activityService.logActivity(userId, 'QUESTION_ADDED', 1);
        
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
        if (body.topic) data.topic = body.topic
        if (body.explanation) data.explanation = body.explanation
        if (body.status !== undefined) data.status = body.status

        const response = await MCQRepository.updateMCQ(questionId, data);
        
        // Log activity
        await activityService.logActivity(userId, 'QUESTION_UPDATED', 1);
        
        return response;
    },
    bookmarkQuestion: async (userId, body) => {
        if (!userId) throw new CustomError(400, "User ID is required");

        const mcq = await MCQRepository.getQuestion({ _id: body.questionId, user: userId });
        if (!mcq) throw new CustomError(404, "Question not found");

        const newData = {
            bookmark: body.bookmark
        }

        const response = await MCQRepository.updateMCQ(body.questionId, newData);
        return response;
    },

    trackOptionClick: async (userId, questionId, body) => {
        if (!userId) throw new CustomError(400, "User ID is required");
        if (!questionId) throw new CustomError(400, "Question ID is required");

        const { error, value } = trackQuestionInteractionSchema.validate(body);
        if (error) throw new CustomError(400, error.details[0].message);

        const mcq = await MCQRepository.getQuestion({ _id: questionId, user: userId });
        if (!mcq) throw new CustomError(404, "Question not found");

        if (!mcq.options.includes(value.selectedAnswer)) {
            throw new CustomError(400, "Selected answer is invalid for this question");
        }

        const isCorrect = mcq.correctAnswer === value.selectedAnswer;

        await QuestionOptionClick.create({
            user: userId,
            question: questionId,
            selectedAnswer: value.selectedAnswer,
            isCorrect
        });

        const statsMap = await getInteractionStatsByQuestion(userId, [questionId]);

        return {
            questionId,
            selectedAnswer: value.selectedAnswer,
            isCorrect,
            stats: statsMap[questionId] || {
                totalClicks: 0,
                correctClicks: 0,
                incorrectClicks: 0,
                accuracy: 0,
                lastClickedAt: null
            }
        };
    },

    getQuestionInteractionSummary: async (userId, query) => {
        if (!userId) throw new CustomError(400, "User ID is required");

        const matchStage = buildQuestionMatchStage(userId, query);
        const createdAtFilter = buildCreatedAtFilter(query);
        const questions = await MCQ.find(matchStage)
            .select("_id question subject")
            .populate("subject", "subject")
            .lean();
        const questionIds = questions.map((item) => item._id);

        if (questionIds.length === 0) {
            return {
                totalClicks: 0,
                uniqueQuestionsAttempted: 0,
                correctClicks: 0,
                incorrectClicks: 0,
                accuracy: 0,
                questionBreakdown: []
            };
        }

        const groupedStats = await QuestionOptionClick.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    question: { $in: questionIds },
                    ...(createdAtFilter ? { createdAt: createdAtFilter } : {})
                }
            },
            {
                $group: {
                    _id: "$question",
                    totalClicks: { $sum: 1 },
                    correctClicks: {
                        $sum: { $cond: ["$isCorrect", 1, 0] }
                    },
                    incorrectClicks: {
                        $sum: { $cond: ["$isCorrect", 0, 1] }
                    },
                    lastClickedAt: { $max: "$createdAt" }
                }
            },
            { $sort: { lastClickedAt: -1 } }
        ]);

        const questionMap = questions.reduce((acc, item) => {
            acc[item._id.toString()] = item;
            return acc;
        }, {});

        const questionBreakdown = groupedStats.map((item) => {
            const totalClicks = item.totalClicks || 0;
            const question = questionMap[item._id.toString()];
            return {
                questionId: item._id,
                question: question?.question || "Question unavailable",
                subject: question?.subject?.subject || "Unassigned",
                totalClicks,
                correctClicks: item.correctClicks || 0,
                incorrectClicks: item.incorrectClicks || 0,
                accuracy: totalClicks > 0 ? Math.round(((item.correctClicks || 0) / totalClicks) * 100) : 0,
                lastClickedAt: item.lastClickedAt || null
            };
        });

        const totalClicks = questionBreakdown.reduce((sum, item) => sum + item.totalClicks, 0);
        const correctClicks = questionBreakdown.reduce((sum, item) => sum + item.correctClicks, 0);
        const incorrectClicks = questionBreakdown.reduce((sum, item) => sum + item.incorrectClicks, 0);

        return {
            totalClicks,
            uniqueQuestionsAttempted: questionBreakdown.length,
            correctClicks,
            incorrectClicks,
            accuracy: totalClicks > 0 ? Math.round((correctClicks / totalClicks) * 100) : 0,
            questionBreakdown
        };
    },

    getQuestionInteractionDetail: async (userId, questionId, query) => {
        if (!userId) throw new CustomError(400, "User ID is required");
        if (!questionId) throw new CustomError(400, "Question ID is required");

        const createdAtFilter = buildCreatedAtFilter(query);
        const question = await MCQ.findOne({ _id: questionId, user: userId })
            .populate("subject", "subject")
            .populate("topic", "topic")
            .populate("comments.user", "name email")
            .lean();

        if (!question) throw new CustomError(404, "Question not found");

        const clickQuery = {
            user: new mongoose.Types.ObjectId(userId),
            question: new mongoose.Types.ObjectId(questionId),
            ...(createdAtFilter ? { createdAt: createdAtFilter } : {})
        };

        const clickHistory = await QuestionOptionClick.find(clickQuery)
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();

        const totalClicks = clickHistory.length;
        const correctClicks = clickHistory.filter((item) => item.isCorrect).length;
        const incorrectClicks = totalClicks - correctClicks;

        const optionBreakdown = question.options.map((option) => {
            const clicks = clickHistory.filter((item) => item.selectedAnswer === option).length;
            const correct = clickHistory.filter((item) => item.selectedAnswer === option && item.isCorrect).length;
            return {
                option,
                clicks,
                correct,
                incorrect: clicks - correct
            };
        });

        return {
            question: {
                _id: question._id,
                question: question.question,
                options: question.options,
                correctAnswer: question.correctAnswer,
                explanation: question.explanation,
                difficulty: question.difficulty,
                subject: question.subject,
                topic: question.topic
            },
            summary: {
                totalClicks,
                correctClicks,
                incorrectClicks,
                accuracy: totalClicks > 0 ? Math.round((correctClicks / totalClicks) * 100) : 0
            },
            optionBreakdown,
            clickHistory,
            comments: question.comments || []
        };
    },

    addQuestionComment: async (userId, questionId, body) => {
        if (!userId) throw new CustomError(400, "User ID is required");
        if (!questionId) throw new CustomError(400, "Question ID is required");

        const { error, value } = addQuestionCommentSchema.validate(body);
        if (error) throw new CustomError(400, error.details[0].message);

        const question = await MCQRepository.getQuestion({ _id: questionId, user: userId });
        if (!question) throw new CustomError(404, "Question not found");

        question.comments = question.comments || [];
        question.comments.push({
            user: userId,
            comment: value.comment
        });

        await question.save();

        const updatedQuestion = await MCQ.findById(questionId)
            .populate("comments.user", "name email")
            .lean();

        return updatedQuestion?.comments || [];
    },
}

module.exports = { mcqService };
