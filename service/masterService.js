const masterRepository = require("../repository/masterRepository");
const CustomError = require("../utility/CustomError");


class MasterService {
    createSubjectAndTopic = async (userId, data) => {
        const { subject, topics } = data;

        const subjectPayload = {
            user: userId,
            subject: subject
        }

        const sub = await masterRepository.createSubject(subjectPayload);
        
        if (sub) {
            const subjectId = sub?._id;

            const topicPayload = topics?.map((topicName) => 
                ( {
                    user: userId,
                    subject: subjectId,
                    topic: topicName,
                })
            )            

            const topicRes = await masterRepository.createManyTopics(topicPayload)
            return {subject:sub,topics:topicRes}
        } else {
            throw new CustomError(400, "Failed to create Subject");
        }
    }
    getSubjectList = async(userId) =>{
        if (!userId) throw new CustomError(400, "User ID is required");

        const subjects = await masterRepository.getSubjectList(userId);
        if (!subjects || subjects.length === 0) throw new CustomError(404, "No subjects found");

        return subjects;
    }
    getTopicList = async(userId, subjectId) =>{
        if (!userId) throw new CustomError(400, "User ID is required");

        const topics = await masterRepository.getTopicList(userId,subjectId);
        if (!topics || topics.length === 0) throw new CustomError(404, "No topics found");

        return topics;
    }
}

module.exports = new MasterService();