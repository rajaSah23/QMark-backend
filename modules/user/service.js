"use strict"

const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const repository = require("./repository")
const CustomError = require("../../utils/CustomError")
const { generateToken } = require("../../utils/generateToken")

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateOTP = () => Math.floor(100000 + Math.random() * 900000)

// ─── Service Methods ──────────────────────────────────────────────────────────

const registerUser = async (userData) => {
  const { name, email, password } = userData

  const userExists = await repository.findByEmail(email)
  if (userExists && userExists.active) {
    throw new CustomError(409, "User already exists")
  }

  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash(password, salt)
  const otp = generateOTP()
  const otpPayload = {
    name,
    password: hashedPassword,
    otp,
    otpExpiresAt: new Date(Date.now() + 60000)
  }

  let user
  if (userExists && !userExists.active) {
    user = await repository.updateUserById(userExists._id, {
      ...otpPayload,
      active: true
    })
  } else {
    user = await repository.createUser({ ...otpPayload, email })
  }

  if (!user) throw new CustomError(400, "Invalid user data")

  // NOTE: In production, send OTP via email. OTP returned here for testing.
  return {
    name: user.name,
    email: user.email,
    message: "OTP sent on email and is valid for one min",
    otp
  }
}

const verifyOTP = async (email, otp) => {
  const user = await repository.findByEmail(email)
  if (!user) throw new CustomError(400, "Invalid email")

  if (user.otp != otp) throw new CustomError(400, "Invalid OTP")
  if (new Date() > user.otpExpiresAt)
    throw new CustomError(401, "OTP expired, please resend the OTP")

  await repository.updateUserById(user._id, { isVerified: true })

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    token: generateToken(user._id)
  }
}

const resendOTP = async (email) => {
  const user = await repository.findByEmail(email)
  if (!user) throw new CustomError(401, "Invalid email")

  const otp = generateOTP()
  const updatedUser = await repository.updateUserById(user._id, {
    otp,
    otpExpiresAt: new Date(Date.now() + 60000)
  })

  // NOTE: In production, send OTP via email.
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    message: "OTP sent on email and is valid for one min",
    otp: updatedUser?.otp
  }
}

const forgetPassword = async (email) => {
  const user = await repository.findByEmail(email)
  if (!user) throw new CustomError(400, "Invalid email")
  if (!user.active) throw new CustomError(403, "Access denied, user is inactive")

  const token = await repository.updateOrCreateToken(user._id, {
    userId: user._id,
    token: generateToken(user._id, "10m")
  })

  // NOTE: In production, send reset link via email.
  return {
    token: token.token,
    link: `${process.env.FRONTEND_URL}/reset-password/${token.token}`
  }
}

const resetPassword = async (token, password) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET)

  if (decoded.iat >= decoded.exp) {
    throw new CustomError(400, "Link Invalid or Expired")
  }

  const dbToken = await repository.findToken({ userId: decoded.id })
  if (!dbToken || token !== dbToken.token) {
    throw new CustomError(400, "Link Invalid or Expired")
  }

  let user = await repository.findById(decoded.id)
  user = await repository.findByEmail(user?.email)
  if (!user) throw new CustomError(404, "User does not exist")

  if (await bcrypt.compare(password, user.password)) {
    throw new CustomError(400, "New password should not be same as old password")
  }

  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash(password, salt)

  const updated = await repository.updateUserById(user._id, {
    password: hashedPassword
  })
  if (!updated) throw new CustomError(500, "Something went wrong")

  await repository.deleteToken(dbToken._id)
  return {}
}

const loginUser = async (userData) => {
  const { email, password } = userData

  const user = await repository.findByEmail(email)
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new CustomError(400, "Invalid email or password")
  }

  if (!user.active) throw new CustomError(403, "Access denied, user is inactive")
  if (!user.isVerified)
    throw new CustomError(
      405,
      "Account is not verified, Please verify using email"
    )

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    token: generateToken(user._id)
  }
}

const getUserProfile = async (userId) => {
  const user = await repository.findById(userId)
  if (!user) throw new CustomError(404, "User not found")

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
}

const changePassword = async (userId, userData) => {
  const { oldPassword, newPassword } = userData

  let user = await repository.findById(userId)
  user = await repository.findByEmail(user.email)
  if (!user) throw new CustomError(404, "User not found")

  if (!(await bcrypt.compare(oldPassword, user.password))) {
    throw new CustomError(400, "Incorrect old password")
  }

  if (await bcrypt.compare(newPassword, user.password)) {
    throw new CustomError(400, "New password should not be same as old password")
  }

  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash(newPassword, salt)

  const updated = await repository.updateUserById(user._id, {
    password: hashedPassword
  })
  if (!updated) throw new CustomError(500, "Internal Server Error")

  return { message: "Password changed successfully" }
}

module.exports = {
  registerUser,
  verifyOTP,
  resendOTP,
  forgetPassword,
  resetPassword,
  loginUser,
  getUserProfile,
  changePassword
}
