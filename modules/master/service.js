"use strict"

const repository = require("./repository")
const CustomError = require("../../utils/CustomError")

const createSubjectAndTopic = async (userId, data) => {
  const { subject, topics } = data

  const isSubExists = await repository.findSubject({
    user: userId,
    subject: subject?.trim(),
    active: true
  })
  if (isSubExists) throw new CustomError(400, "Subject already exists")

  const sub = await repository.createSubject({
    user: userId,
    subject: subject?.trim()
  })
  if (!sub) throw new CustomError(400, "Failed to create Subject")

  const topicPayload = topics?.map((topicName) => ({
    user: userId,
    subject: sub._id,
    topic: topicName
  }))

  const topicRes = await repository.createManyTopics(topicPayload)
  return { subject: sub, topics: topicRes }
}

const createSubject = async (userId, data) => {
  const { subject } = data
  if (!subject) throw new CustomError(400, "Subject name is required")

  const isSubExists = await repository.findSubject({
    user: userId,
    subject: subject?.trim(),
    active: true
  })
  if (isSubExists) throw new CustomError(400, "Subject already exists")

  const sub = await repository.createSubject({ user: userId, subject: subject?.trim() })
  if (!sub) throw new CustomError(400, "Failed to create Subject")
  return sub
}

const addTopic = async (userId, data) => {
  if (!userId) throw new CustomError(400, "User ID is required")
  const { subjectId, topic } = data
  if (!subjectId) throw new CustomError(400, "subjectId is required")
  if (!topic) throw new CustomError(400, "Topic is required")

  const isTopicExists = await repository.findTopic({
    user: userId,
    subject: subjectId,
    topic,
    active: true
  })
  if (isTopicExists) throw new CustomError(400, "Topic already exists")

  return await repository.createTopic({
    user: userId,
    subject: subjectId,
    topic: topic.trim()
  })
}

const updateSubjectById = async (userId, subjectId, data) => {
  if (!subjectId) throw new CustomError(400, "Subject Id is required")
  if (!data || Object.keys(data).length === 0)
    throw new CustomError(400, "Data to update is required")

  const isSubExists = await repository.findSubject({
    user: userId,
    subject: data?.subject?.trim(),
    active: true
  })
  if (isSubExists) throw new CustomError(400, "Subject already exists")

  const subject = await repository.updateSubjectById(subjectId, {
    subject: data?.subject
  })
  if (!subject) throw new CustomError(404, "Subject not found")
  return subject
}

const getSubjectList = async (userId) => {
  if (!userId) throw new CustomError(400, "User ID is required")
  return await repository.getSubjectList(userId)
}

const deleteSubjectById = async (subjectId) => {
  if (!subjectId) throw new CustomError(400, "Subject Id is required")
  const subject = await repository.deleteSubjectById(subjectId)
  if (!subject) throw new CustomError(404, "Subject not found")
  return subject
}

const deleteTopicById = async (topicId) => {
  if (!topicId) throw new CustomError(400, "Topic Id is required")
  const topic = await repository.updateTopicById(topicId, { active: false })
  if (!topic) throw new CustomError(404, "Topic not found")
  return topic
}

const getTopicList = async (userId, subjectId) => {
  if (!userId) throw new CustomError(400, "User ID is required")
  return await repository.getTopicList(userId, subjectId)
}

const updateTopicById = async (topicId, data) => {
  if (!topicId) throw new CustomError(400, "Topic Id is required")
  if (!data || Object.keys(data).length === 0)
    throw new CustomError(400, "Data to update is required")

  const topic = await repository.updateTopicById(topicId, { topic: data?.topic })
  if (!topic) throw new CustomError(404, "Topic not found")
  return topic
}

module.exports = {
  createSubjectAndTopic,
  createSubject,
  addTopic,
  updateSubjectById,
  getSubjectList,
  deleteSubjectById,
  deleteTopicById,
  getTopicList,
  updateTopicById
}
