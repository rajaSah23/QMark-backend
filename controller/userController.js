const userService = require("../service/userService");
const { successResponse } = require("../utility/successResponse");

class UserController {
    registerUser = async (req, res) => {
        const response = await userService.registerUser(req.body);

        res.status(201).json(successResponse(201, response, "User registered"))
    }

    async verifyOTP(req, res) {
        const { email, otp } = req.body;
        const userData = await userService.verifyOTP(email, otp);
        res.status(200).json(successResponse(200, userData, "OTP verified successfully"));
    }
    async resendOTP(req, res) {
        const { email } = req.body;
        const userData = await userService.resendOTP(email);
        res.status(200).json(successResponse(200, userData, "OTP sent on email and is valid for one min"));
    }

    async forgetPassword(req, res) {
        const { email } = req.body;
        const response = await userService.forgetPassword(email);
        res.status(200).json(successResponse(200, response, "Link sent via e-mail, Please check e-mail"));
    }

    async resetPassword(req, res) {
        const { token, password } = req.body;
        const response = await userService.resetPassword(token, password);
        res.status(202).json(successResponse(202, response, "Password changed successfully"));

    }


    async loginUser(req, res) {
        const response = await userService.loginUser(req.body);

        res.status(200).json(successResponse(200, response, "User logged in"))
    }

    async getUser(req, res) {
        const user = await userService.getUserProfile(req.user.id);
        res.status(200).json(successResponse(200, user, "User info sent"));
    }

    async changePassword(req, res) {
        const updatedUser = await userService.changePassword(req.user.id, req.body);
        res.status(202).json(successResponse(202, null, "Password changed successfully"));
    }


}

module.exports = new UserController();