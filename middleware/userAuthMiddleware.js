const jwt = require('jsonwebtoken');
const User = require('../db/model/User');
const { successResponse } = require('../utility/successResponse');

const userAuth = async (req, res, next) => {
    try {
        let token;

        // Check if auth header exists and has the right format
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            try {
                // Get token from header
                token = req.headers.authorization.split(' ')[1];

                // Verify token
                const decoded = jwt.verify(token, process.env.JWT_SECRET);

                // Get user from token
                req.user = await User.findById(decoded.id).select('-password');

                if (!req.user) {
                    return res.status(401).json(successResponse(401, null, 'Not authorized, user not found'));
                }

                //Check if user is active
                if (!req.user.active) {
                    return res.status(403).json(successResponse(403, null, 'Access denied, user is inactive'));
                }

                next();
            } catch (error) {
                console.error(error);
                res.status(401).json(successResponse(401, null, 'Not authorized, token failed'));
            }
        }

        if (!token) {
            res.status(401).json(successResponse(401, null, 'Not authorized, no token'));
        }
    } catch (error) {
        res.status(500).json(successResponse(500, null, error.message));
    }
};

// Middleware to check if user is admin
const adminAuth = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json(successResponse(401, null, 'Not authorized, user missing'));
        }
        // console.log("req.user.role", req.user?.role);

        if (req.user.role !== 'admin') {
            return res.status(403).json(successResponse(403, null, 'Access denied, admin only'));
        }

        next();
    } catch (error) {
        res.status(500).json(successResponse(500, null, error.message));
    }
};


module.exports = { userAuth, adminAuth };