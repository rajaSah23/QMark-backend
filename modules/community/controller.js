"use strict"

const service = require("./service")
const { successResponse } = require("../../utils/response")

const listCommunities = async (req, res) => {
  const response = await service.listCommunities(req.user.id, req.query)
  res
    .status(200)
    .json(successResponse(200, response, "Communities sent successfully"))
}

const createCommunity = async (req, res) => {
  const response = await service.createCommunity(req.user.id, req.body)
  res
    .status(201)
    .json(successResponse(201, response, "Community created successfully"))
}

const getCommunityBySlug = async (req, res) => {
  const response = await service.getCommunityBySlug(req.user.id, req.params.slug)
  res
    .status(200)
    .json(successResponse(200, response, "Community sent successfully"))
}

const updateCommunity = async (req, res) => {
  const response = await service.updateCommunity(
    req.user.id,
    req.params.communityId,
    req.body
  )
  res
    .status(202)
    .json(successResponse(202, response, "Community updated successfully"))
}

const deleteCommunity = async (req, res) => {
  const response = await service.deleteCommunity(
    req.user.id,
    req.params.communityId
  )
  res
    .status(202)
    .json(successResponse(202, response, "Community deleted successfully"))
}

const joinCommunity = async (req, res) => {
  const response = await service.joinCommunity(
    req.user.id,
    req.params.communityId
  )
  res.status(201).json(
    successResponse(
      201,
      response,
      response.joined ? "Joined community successfully" : "Join request sent"
    )
  )
}

const leaveCommunity = async (req, res) => {
  const response = await service.leaveCommunity(
    req.user.id,
    req.params.communityId
  )
  res.status(202).json(successResponse(202, response, "Left community"))
}

const reactToCommunity = async (req, res) => {
  const response = await service.reactToCommunity(
    req.user.id,
    req.params.communityId,
    req.body
  )
  res.status(201).json(successResponse(201, response, "Reaction saved"))
}

const listMembers = async (req, res) => {
  const response = await service.listMembers(req.user.id, req.params.communityId)
  res.status(200).json(successResponse(200, response, "Members sent successfully"))
}

const changeMemberRole = async (req, res) => {
  const response = await service.changeMemberRole(
    req.user.id,
    req.params.communityId,
    req.params.userId,
    req.body
  )
  res.status(202).json(successResponse(202, response, "Role updated"))
}

const removeMember = async (req, res) => {
  const response = await service.removeMember(
    req.user.id,
    req.params.communityId,
    req.params.userId
  )
  res.status(202).json(successResponse(202, response, "Member removed"))
}

const inviteUser = async (req, res) => {
  const response = await service.inviteUser(
    req.user.id,
    req.params.communityId,
    req.body
  )
  res.status(201).json(successResponse(201, response, "Invitation sent"))
}

const listPendingRequests = async (req, res) => {
  const response = await service.listPendingRequests(
    req.user.id,
    req.params.communityId
  )
  res
    .status(200)
    .json(successResponse(200, response, "Pending requests sent successfully"))
}

const listMyInvitations = async (req, res) => {
  const response = await service.listMyInvitations(req.user.id)
  res
    .status(200)
    .json(successResponse(200, response, "Invitations sent successfully"))
}

const respondToRequest = async (req, res) => {
  const response = await service.respondToRequest(
    req.user.id,
    req.params.requestId,
    req.body
  )
  res.status(202).json(successResponse(202, response, "Request resolved"))
}

const shareQuestion = async (req, res) => {
  const response = await service.shareQuestion(
    req.user.id,
    req.params.communityId,
    req.body.questionId
  )
  res.status(201).json(
    successResponse(
      201,
      response,
      response.status === "pending"
        ? "Question sent for review"
        : "Question shared successfully"
    )
  )
}

const unshareQuestion = async (req, res) => {
  const response = await service.unshareQuestion(
    req.user.id,
    req.params.communityId,
    req.params.questionId
  )
  res.status(202).json(successResponse(202, response, "Question removed"))
}

const listCommunityQuestions = async (req, res) => {
  const response = await service.listCommunityQuestions(
    req.user.id,
    req.params.communityId,
    req.query
  )
  res
    .status(200)
    .json(successResponse(200, response, "Questions sent successfully"))
}

const moderateQuestion = async (req, res) => {
  const response = await service.moderateQuestion(
    req.user.id,
    req.params.shareId,
    req.body
  )
  res.status(202).json(successResponse(202, response, "Question reviewed"))
}

const getQuestionShares = async (req, res) => {
  const response = await service.getQuestionShares(
    req.user.id,
    req.params.questionId
  )
  res.status(200).json(successResponse(200, response, "Shares sent successfully"))
}

module.exports = {
  listCommunities,
  createCommunity,
  getCommunityBySlug,
  updateCommunity,
  deleteCommunity,
  joinCommunity,
  leaveCommunity,
  reactToCommunity,
  listMembers,
  changeMemberRole,
  removeMember,
  inviteUser,
  listPendingRequests,
  listMyInvitations,
  respondToRequest,
  shareQuestion,
  unshareQuestion,
  listCommunityQuestions,
  moderateQuestion,
  getQuestionShares
}
