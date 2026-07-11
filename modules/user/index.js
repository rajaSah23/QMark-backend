"use strict"

const express = require("express")
const router = express.Router()
const controller = require("./controller")
const asyncHandler = require("../../middlewares/asyncHandler")
const { userAuth } = require("../../middlewares/auth")

// Public routes
router.post("/register", asyncHandler(controller.registerUser))
router.post("/login", asyncHandler(controller.loginUser))
router.post("/verify-otp", asyncHandler(controller.verifyOTP))
router.post("/resend-otp", asyncHandler(controller.resendOTP))
router.post("/forgot-password", asyncHandler(controller.forgetPassword))
router.post("/reset-password", asyncHandler(controller.resetPassword))

// Protected routes
router.get("/profile", userAuth, asyncHandler(controller.getUser))
router.put("/change-password", userAuth, asyncHandler(controller.changePassword))

module.exports = router
