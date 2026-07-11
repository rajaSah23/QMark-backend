"use strict"

const service = require("./service")
const { successResponse } = require("../../utils/response")

const addSubjectAndTopics = async (req, res, next) => {
  const response = await service.createSubjectAndTopic(req.user.id, req.body)
  res
    .status(201)
    .json(successResponse(201, response, "Subject and topics added"))
}

const addSubject = async (req, res, next) => {
  const response = await service.createSubject(req.user.id, req.body)
  res.status(201).json(successResponse(201, response, "Subject added"))
}

const addTopic = async (req, res, next) => {
  const response = await service.addTopic(req.user.id, req.body)
  res.status(201).json(successResponse(201, response, "Topic added"))
}

const getSubject = async (req, res, next) => {
  const response = await service.getSubjectList(req.user.id)
  res.status(200).json(successResponse(200, response, "Subject list sent"))
}

const deleteSubject = async (req, res, next) => {
  const response = await service.deleteSubjectById(req.params.subjectId)
  res.status(200).json(successResponse(200, response, "Subject deleted"))
}

const deleteTopic = async (req, res, next) => {
  const response = await service.deleteTopicById(req.params.topicId)
  res.status(200).json(successResponse(200, response, "Topic deleted"))
}

const updateSubject = async (req, res, next) => {
  const response = await service.updateSubjectById(
    req.user.id,
    req.params.subjectId,
    req.body
  )
  res.status(202).json(successResponse(202, response, "Subject Updated"))
}

const getTopics = async (req, res, next) => {
  const response = await service.getTopicList(req.user.id, req.params.subjectId)
  res.status(200).json(successResponse(200, response, "Topic list sent"))
}

const updateTopic = async (req, res, next) => {
  const response = await service.updateTopicById(req.params.topicId, req.body)
  res.status(202).json(successResponse(202, response, "Topic Updated"))
}

module.exports = {
  addSubjectAndTopics,
  addSubject,
  addTopic,
  getSubject,
  deleteSubject,
  deleteTopic,
  updateSubject,
  getTopics,
  updateTopic
}
