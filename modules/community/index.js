"use strict"

const express = require("express")
const router = express.Router()
const controller = require("./controller")
const asyncHandler = require("../../middlewares/asyncHandler")
const { userAuth } = require("../../middlewares/auth")

// All community routes require authentication.
router.use(userAuth)

// Caller-scoped routes first — "me" and "requests" must not be read as a slug.
router.get("/me/invitations", asyncHandler(controller.listMyInvitations))
router.post("/requests/:requestId/respond", asyncHandler(controller.respondToRequest))

router.get("/", asyncHandler(controller.listCommunities))
router.post("/", asyncHandler(controller.createCommunity))

router.get("/:communityId/members", asyncHandler(controller.listMembers))
router.patch(
  "/:communityId/members/:userId",
  asyncHandler(controller.changeMemberRole)
)
router.delete(
  "/:communityId/members/:userId",
  asyncHandler(controller.removeMember)
)

router.post("/:communityId/join", asyncHandler(controller.joinCommunity))
router.post("/:communityId/leave", asyncHandler(controller.leaveCommunity))
router.post("/:communityId/react", asyncHandler(controller.reactToCommunity))
router.post("/:communityId/invites", asyncHandler(controller.inviteUser))
router.get("/:communityId/requests", asyncHandler(controller.listPendingRequests))

router.put("/:communityId", asyncHandler(controller.updateCommunity))
router.delete("/:communityId", asyncHandler(controller.deleteCommunity))

// Slug lookup last so it cannot shadow the routes above.
router.get("/:slug", asyncHandler(controller.getCommunityBySlug))

module.exports = router
