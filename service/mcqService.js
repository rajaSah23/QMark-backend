const MCQRepository = require("../repository/MCQRepository");

const mcqService = {
    getMCQs : async(query)=>{        
        const response = await MCQRepository.getMCQs(query);
        return response;
    },
    getMCQById : async(params)=>{
        const response = await MCQRepository.getMCQById(params.questionId);
        return response;
    },
    deleteMCQById : async(params)=>{
        const response = await MCQRepository.deleteMCQById(params.questionId);
        return response;
    },
    postMCQs : async(body)=>{
        const data = {}
            if(body.question) data.question=body.question
            if(body.options) data.options=body.options
            if(body.correctAnswer) data.correctAnswer=body.correctAnswer
            if(body.difficulty) data.difficulty=body.difficulty
            if(body.tag) data.tag=body.tag
            if(body.subject) data.subject=body.subject
            if(body.explanation) data.explanation=body.explanation  
            if(body.status) data.status=body.status  
            console.log(data);
            
        const response = await MCQRepository.postMCQs(data);
        return response;
    },
    updateMCQ : async(body)=>{
        const questionId = body.questionId;
        const data = {}
            if(body.question) data.question=body.question
            if(body.options) data.options=body.options
            if(body.tag) data.tag=body.tag
            if(body.correctAnswer) data.correctAnswer=body.correctAnswer
            if(body.difficulty) data.difficulty=body.difficulty
            if(body.subject) data.subject=body.subject
            if(body.explanation) data.explanation=body.explanation 
            if(body.status) data.status=body.status  
       
        
        const response = await MCQRepository.updateMCQ(questionId,data);
        return response;
    },
}

module.exports = {mcqService};