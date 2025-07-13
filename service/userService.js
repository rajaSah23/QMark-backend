const userRepository = require("../repository/userRepository");
const CustomError = require("../utility/CustomError");
const bcrypt = require('bcryptjs');
const { generateToken } = require("../utility/generateToken");
const tokenRepository = require("../repository/tokenRepository");
const jwt = require('jsonwebtoken');



// Generate a 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000);
}

class Service {
    registerUser = async (userData) => {
        const { name, email, password } = userData;
        // Check if user exists
        const userExists = await userRepository.findByEmail(email);
        if (userExists && userExists?.active) {
            throw new CustomError(409, 'User already exists');
        }
        // return res;

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const otp = generateOTP();

        let user = null;
        if (userExists && !userExists?.active) {
            // Update user
            user = await userRepository.updateUserById(userExists?._id, {
                name,
                password: hashedPassword,
                active: true,
                otp: otp,
                otpExpiresAt: new Date(Date.now() + 60000) //in 60 sec
            });
        } else {
            // Create user
            user = await userRepository.createUser({
                name,
                email,
                password: hashedPassword,
                otp: otp,
                otpExpiresAt: new Date(Date.now() + 60000) //in 60 sec
            });

        }

        if (user) {
            // const isOTPSent = await sendOTPonMail(email, otp);
            // console.log("OTP sent on mail :", isOTPSent);
            const response = {
                name: user.name,
                email: user.email,
                message: "OTP sent on email and is valid for one min",
                otp: otp // just for testing purpose
            };
            return response
        } else {
            throw new CustomError(400, 'Invalid user data');
        }
    }


    async verifyOTP(email, otp) {
        //is user exist ? 
        const user = await userRepository.findByEmail(email);
        if (!user) throw new CustomError(400, 'Invalid email');

        if (user?.otp == otp) {
            if (new Date() > user?.otpExpiresAt) throw new CustomError(401, 'OTP expired, please resend the OTP');

            const updatedUser = await userRepository.updateUserById(user?._id, { isVerified: true });
            const responseData = {
                _id: user._id,
                name: user.name,
                email: user.email,
                token: generateToken(user._id)
            };
            return responseData
        } else {
            throw new CustomError(400, 'Invalid OTP');
        }
    }

    async resendOTP(email) {
        const user = await userRepository.findByEmail(email);

        if (user) {
            const otp = generateOTP();
            //update OTP and expiryDate
            const updatedOTPData = {
                otp: otp,
                otpExpiresAt: new Date(Date.now() + 60000) //in 60 sec
            }
            const updatedUser = await userRepository.updateUserById(user?._id, updatedOTPData);
            console.log("OTP resent", updatedUser);

            // const isOTPSent = await sendOTPonMail(email, otp);
            // console.log("OTP sent on mail :", isOTPSent);

            const responseData = {
                _id: user._id,
                name: user.name,
                email: user.email,
                message: `OTP sent on email and is valid for one min`,
                otp: updatedUser?.otp
            };
            return responseData
        } else {
            throw new CustomError(401, 'Invalid email');
        }
    }



    async forgetPassword(email) {
        const user = await userRepository.findByEmail(email);

        if (user) {
            if (!user.active) {
                throw new CustomError(403, 'Access denied, user is inactive')
            }
            let token = await tokenRepository.findOne({ userId: user._id });

            if (true) {
                //create a new Token: {userId,token}
                token = await tokenRepository.updateOrCreate(user._id, {
                    userId: user._id,
                    token: generateToken(user._id, "10m")
                })
            }
            // const link = `${process.env.BASE_URL}/reset-password/${token.token}`; //Replace this base URL with frontend base url
            // //send link via mail
            // const isMailSent = await sendResetPasswordLinkOnMail(user?.email, link);
            // console.log("isMailSent", isMailSent);

            const responseData = {
                // message:"Link sent via e-mail",
                token: token.token,
                link : `${process.env.FRONTEND_URL}/reset-password/${token.token}` 
            }
            return responseData
        } else {
            throw new CustomError(400, 'Invalid email');
        }
    }
    async resetPassword(token, password) {

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("decoded", decoded);


        if (decoded.iat >= decoded.exp) {
            throw new CustomError(400, "Link Invalid or Expired")
        }

        const dbToken = await tokenRepository.findOne({ userId: decoded.id });

        if (!dbToken || token !== dbToken.token) {
            throw new CustomError(400, "Link Invalid or Expired");
        }

        let user = await userRepository.findById(decoded.id);
        user = await userRepository.findByEmail(user?.email);

        if (user) {
            if (await bcrypt.compare(password, user.password)) {
                throw new CustomError(400, 'New password should not be same as old password');
            }
            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);


            const response = await userRepository.updateUserById(user._id, { password: hashedPassword })


            if (response) {
                await tokenRepository.delete(dbToken._id);
                const responseData = {
                    // message:"Password changed successfully",
                }
                return responseData
            }
            else {
                throw new CustomError(500, 'Something went wrong');
            }
        } else {
            throw new CustomError(404, 'User does not exists');
        }
    }

    async loginUser(userData) {
        const { email, password } = userData;
        // Check for user email
        const user = await userRepository.findByEmail(email);

        if (user && (await bcrypt.compare(password, user.password))) {
            if (!user.active) {
                throw new CustomError(403, 'Access denied, user is inactive')
            }

            if (!user.isVerified) {
                throw new CustomError(405, 'Account is not verified, Please verify using email');
            }

            const responseData = {
                _id: user._id,
                name: user.name,
                email: user.email,
                // message:"Login successfull",
                token: generateToken(user._id)
            };
            return responseData ;
        } else {
            throw new CustomError(400, 'Invalid email or password');
        }
    }

    async getUserProfile(userId) {
        const user = await userRepository.findById(userId);
        if (!user) {
            throw new CustomError(404, 'User not found');
        }
        const responseData = {
            _id: user?._id,
            name: user?.name,
            email: user?.email,
            isVerified: user?.isVerified,
            createdAt: user?.createdAt,
            updatedAt: user?.updatedAt,
        }
        return responseData;
    }

    async changePassword(userId, userData) {
        const { oldPassword, newPassword } = userData;
        console.log(oldPassword, newPassword);

        let user = await userRepository.findById(userId);
        user = await userRepository.findByEmail(user.email);
        // console.log("user",user);

        if (!user) {
            throw new CustomError(404, 'User not found');
        }

        if (!await bcrypt.compare(oldPassword, user.password)) {
            throw new CustomError(400, "Incorrect old password");
        }

        if (await bcrypt.compare(newPassword, user.password)) {
            throw new CustomError(400, 'New password should not be same as old password');
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        const response = await userRepository.updateUserById(user._id, { password: hashedPassword })

        if (response) {
            return {
                message: "Password changed successfully",
            }
        }
        else {
            throw new CustomError(500, 'Internal Server Error');
        }
    }
}

module.exports = new Service();