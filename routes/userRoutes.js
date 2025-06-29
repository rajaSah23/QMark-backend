const express = require('express');
const userController = require('../controller/userController');
const asyncErrorHandler = require('../middleware/asyncErrorHandler');
const { userAuth } = require('../middleware/userAuthMiddleware');
const router = express.Router();

router.post("/register", asyncErrorHandler(userController.registerUser))
router.post("/login", asyncErrorHandler(userController.loginUser))
router.post("/verify-otp", asyncErrorHandler(userController.verifyOTP))
router.post("/resend-otp", asyncErrorHandler(userController.resendOTP))
router.post("/forget-password", asyncErrorHandler(userController.forgetPassword))
router.post("/reset-password", asyncErrorHandler(userController.resetPassword))

router.get("/profile", userAuth, asyncErrorHandler(userController.getUser))
router.get("/change-password", userAuth, asyncErrorHandler(userController.changePassword))

module.exports = router;