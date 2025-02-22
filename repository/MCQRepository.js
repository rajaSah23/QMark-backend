const MCQ = require("../db/model/MCQModel");
const CustomError = require("../utility/CustomError");
const { updateMCQSchema, createMCQSchema } = require("../validation/MCQValidation");

const MCQRepository = {
    getMCQs: async (query) => {
        if(query.subject==="all"){
            delete query.subject;
        }
        // Pagination parameters
        const page = parseInt(query?.page) || 1;
        const limit = parseInt(query?.limit) || 10;
        const skip = (page - 1) * limit;
        const sortOrder = query?.sort === "ASC" ? 1 : -1;

        // Base query object
        const baseQuery = {};

        // Search logic
        if (query?.search) {
            const searchRegex = new RegExp(query.search, 'i');
            baseQuery.$or = [
                { question: searchRegex },
                { subject: searchRegex },
                { tag: searchRegex }
            ];
        }

        // Filter logic
        if (query?.subject) {
            const subjectRegex = new RegExp(`^${query.subject}$`, 'i');
            baseQuery.subject = subjectRegex;
        }
        if (query?.difficulty) {
            baseQuery.difficulty = query.difficulty;
        }
        if (query?.status) {
            baseQuery.status = query.status === 'true';
        }

        // Get total count
        const total = await MCQ.countDocuments(baseQuery);

        // Get paginated results
        const results = await MCQ.find(baseQuery)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: sortOrder });

        return {
            results,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    },
    getMCQById : async(questionId)=>{
        const  response =  await MCQ.findById(questionId);
        if(!response) throw new CustomError(404,"Question not found");
        return response;
    },
    deleteMCQById : async(questionId)=>{
        
        const  response =  await MCQ.findByIdAndDelete(questionId);
        if(!response) throw new CustomError(404,"Question not found");
        return response;
    },
    postMCQs : async(data)=>{
        const {error} = createMCQSchema.validate(data);
        if (error) throw new CustomError(400, error.details[0].message);

        const newQuestion =  new MCQ(data);
        const  response =  await newQuestion.save();
        return response;
    },
    updateMCQ : async(questionId,data)=>{
        const {error} = updateMCQSchema.validate(data);
        if (error) throw new CustomError(400, error.details[0].message);
        const response = await MCQ.findByIdAndUpdate(questionId,data,{new:true});
        // console.log(response);
        
        if(!response) throw new CustomError(404,"Question not found");
        return response;
    },
}
module.exports = MCQRepository