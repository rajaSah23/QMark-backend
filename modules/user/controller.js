"use strict"

const service = require("./service")
const { successResponse } = require("../../utils/response")

const registerUser = async (req, res, next) => {
  const response = await service.registerUser(req.body)
  res.status(201).json(successResponse(201, response, "User registered"))
}

const verifyOTP = async (req, res, next) => {
  const { email, otp } = req.body
  const data = await service.verifyOTP(email, otp)
  res.status(200).json(successResponse(200, data, "OTP verified successfully"))
}

const resendOTP = async (req, res, next) => {
  const { email } = req.body
  const data = await service.resendOTP(email)
  res
    .status(200)
    .json(successResponse(200, data, "OTP sent on email and is valid for one min"))
}

const forgetPassword = async (req, res, next) => {
  const { email } = req.body
  const response = await service.forgetPassword(email)
  res
    .status(200)
    .json(
      successResponse(200, response, "Link sent via e-mail, Please check e-mail")
    )
}

const resetPassword = async (req, res, next) => {
  const { token, password } = req.body
  const response = await service.resetPassword(token, password)
  res
    .status(202)
    .json(successResponse(202, response, "Password changed successfully"))
}

const loginUser = async (req, res, next) => {
  const response = await service.loginUser(req.body)
  res.status(200).json(successResponse(200, response, "User logged in"))
}

const getUser = async (req, res, next) => {
  const user = await service.getUserProfile(req.user.id)
  res.status(200).json(successResponse(200, user, "User info sent"))
}

const changePassword = async (req, res, next) => {
  await service.changePassword(req.user.id, req.body)
  res
    .status(202)
    .json(successResponse(202, null, "Password changed successfully"))
}

module.exports = {
  registerUser,
  verifyOTP,
  resendOTP,
  forgetPassword,
  resetPassword,
  loginUser,
  getUser,
  changePassword
}
