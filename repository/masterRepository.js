const Subject = require("../db/model/Subject");
const Topic = require("../db/model/Topic");

class MasterRepository {
    async createSubject (data){      
        const subject = await Subject.create(data);
        return subject;
    }
    async createManyTopics (data){     
        const topics = await Topic.insertMany(data);

        return topics;
    }
    async getSubjectList(userId){
        if (!userId) throw new Error("User ID is required");

        const subjects = await Subject.find({ user: userId ,active: true });
        
        if (!subjects || subjects.length === 0) throw new Error("No subjects found");

        return subjects;
    }
    async deleteSubjectById(subjectId){     
        //make it active false
        if (!subjectId) throw new Error("Subject ID is required");
        const subject = await Subject.findByIdAndUpdate(subjectId, { active: false }, { new: true });

        return subject;
    }
    async getTopicList(userId,subjectId){
        if (!userId) throw new Error("User ID is required");

        const topics = await Topic.find({ user: userId, subject:subjectId  }).populate("subject","subject");
        
        if (!topics || topics.length === 0) throw new Error("No topics found");

        return topics;
    }
}

module.exports = new MasterRepository();