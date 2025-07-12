const masterRepository = require("../repository/masterRepository");
const CustomError = require("../utility/CustomError");


class MasterService {
    createSubjectAndTopic = async (userId, data) => {
        const { subject, topics } = data;

        const isSubExists = await masterRepository.findSubject({ user: userId, subject: subject?.trim(), active: true });
        if (isSubExists) {
            throw new CustomError(400, "Subject already exists");
        }

        const subjectPayload = {
            user: userId,
            subject: subject?.trim()
        }

        const sub = await masterRepository.createSubject(subjectPayload);

        if (sub) {
            const subjectId = sub?._id;

            const topicPayload = topics?.map((topicName) =>
            ({
                user: userId,
                subject: subjectId,
                topic: topicName,
            })
            )

            const topicRes = await masterRepository.createManyTopics(topicPayload)
            return { subject: sub, topics: topicRes }
        } else {
            throw new CustomError(400, "Failed to create Subject");
        }
    }
    addTopic = async (userId, data) => {
        if (!userId) throw new CustomError(400, "User ID is required");
        const { subjectId, topic } = data;
        if (!subjectId) throw new CustomError(400, "subjectId is required");
        if (!topic) throw new CustomError(400, "Topic is required");

        const topicPayload = {
            user: userId,
            subject: subjectId,
            topic: topic.trim()
        }

        const isTopicExists = await masterRepository.findTopic({ user: userId, subject: subjectId,topic:topic, active: true });
        if (isTopicExists) {
            console.log(isTopicExists);
            
            throw new CustomError(400, "Topic already exists");
        }

        const topicRes = await masterRepository.createTopic(topicPayload);
        return topicRes;
    }
    updateSubjectById = async (userId, subjectId, data) => {
        if (!subjectId) throw new CustomError(400, "Subject Id is required");
        if (!data || Object.keys(data).length === 0) throw new CustomError(400, "Data to update is required");

        const isSubExists = await masterRepository.findSubject({ user: userId, subject: data?.subject?.trim(), active: true });
        if (isSubExists) {
            throw new CustomError(400, "Subject already exists");
        }

        const newData = {
            subject: data?.subject
        }

        const subject = await masterRepository.updateSubjectById(subjectId, newData);
        if (!subject) throw new CustomError(404, "Subject not found");

        return subject;
    }
    getSubjectList = async (userId) => {
        if (!userId) throw new CustomError(400, "User ID is required");

        const subjects = await masterRepository.getSubjectList(userId);
        if (!subjects || subjects.length === 0) throw new CustomError(404, "No subjects found");

        return subjects;
    }

    deleteSubjectById = async (subjectId) => {
        if (!subjectId) throw new CustomError(400, "Subject Id is required");
        const subject = await masterRepository.deleteSubjectById(subjectId);
        if (!subject) throw new CustomError(404, "Subject not found");
        return subject;
    }
    deleteTopicById = async (topicId) => {
        // if (!topicId) throw new CustomError(400, "Topic Id is required");

        // const topic = await masterRepository.deleteTopicById(topicId);
        // if (!topic) throw new CustomError(404, "Topic not found");

        // return topic;

        if (!topicId) throw new CustomError(400, "Topic Id is required");

        const newData = {
            active: false
        }

        const topic = await masterRepository.updateTopicById(topicId, newData);
        if (!topic) throw new CustomError(404, "Topic not found");

        return topic;
    }


    getTopicList = async (userId, subjectId) => {
        if (!userId) throw new CustomError(400, "User ID is required");

        const topics = await masterRepository.getTopicList(userId, subjectId);
        if (!topics || topics.length === 0) throw new CustomError(404, "No topics found");

        return topics;
    }
    updateTopicById = async (topicId, data) => {
        if (!topicId) throw new CustomError(400, "Topic Id is required");
        if (!data || Object.keys(data).length === 0) throw new CustomError(400, "Data to update is required");

        const newData = {
            topic: data?.topic
        }

        const topic = await masterRepository.updateTopicById(topicId, newData);
        if (!topic) throw new CustomError(404, "Topic not found");

        return topic;
    }
}

module.exports = new MasterService();