"use strict"

const Subject = require("./subjectModel")
const Topic = require("./topicModel")

// ─── Subject CRUD ─────────────────────────────────────────────────────────────

const findSubject = (condition) => Subject.findOne(condition)

const createSubject = (data) => Subject.create(data)

const getSubjectList = async (userId) => {
  if (!userId) throw new Error("User ID is required")
  return (await Subject.find({ user: userId, active: true })) || []
}

const updateSubjectById = (subjectId, data) =>
  Subject.findByIdAndUpdate(subjectId, data, { new: true })

const deleteSubjectById = async (subjectId) => {
  if (!subjectId) throw new Error("Subject ID is required")
  return Subject.findByIdAndUpdate(subjectId, { active: false }, { new: true })
}

// ─── Topic CRUD ───────────────────────────────────────────────────────────────

const findTopic = (condition) => Topic.findOne(condition)

const createTopic = (data) => Topic.create(data)

const createManyTopics = (data) => Topic.insertMany(data)

const updateTopicById = (topicId, data) =>
  Topic.findByIdAndUpdate(topicId, data, { new: true })

const getTopicList = async (userId, subjectId) => {
  if (!userId) throw new Error("User ID is required")
  return (
    (await Topic.find({ user: userId, subject: subjectId, active: true }).populate(
      "subject",
      "subject"
    )) || []
  )
}

module.exports = {
  findSubject,
  createSubject,
  getSubjectList,
  updateSubjectById,
  deleteSubjectById,
  findTopic,
  createTopic,
  createManyTopics,
  updateTopicById,
  getTopicList
}
