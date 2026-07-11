"use strict"

const jwt = require("jsonwebtoken")
const User = require("../modules/user/userModel")
const { successResponse } = require("../utils/response")

/**
 * Verifies the JWT Bearer token and attaches the user to req.user.
 */
const userAuth = async (req, res, next) => {
  try {
    let token

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      try {
        token = req.headers.authorization.split(" ")[1]

        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        req.user = await User.findById(decoded.id).select("-password")

        if (!req.user) {
          return res
            .status(401)
            .json(successResponse(401, null, "Not authorized, user not found"))
        }

        if (!req.user.active) {
          return res
            .status(403)
            .json(successResponse(403, null, "Access denied, user is inactive"))
        }

        next()
      } catch (error) {
        console.error(error)
        return res
          .status(401)
          .json(successResponse(401, null, "Not authorized, token failed"))
      }
    }

    if (!token) {
      return res
        .status(401)
        .json(successResponse(401, null, "Not authorized, no token"))
    }
  } catch (error) {
    res.status(500).json(successResponse(500, null, error.message))
  }
}

/**
 * Restricts a route to admin users only. Must be used after userAuth.
 */
const adminAuth = (req, res, next) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(successResponse(401, null, "Not authorized, user missing"))
    }

    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json(successResponse(403, null, "Access denied, admin only"))
    }

    next()
  } catch (error) {
    res.status(500).json(successResponse(500, null, error.message))
  }
}

module.exports = { userAuth, adminAuth }
