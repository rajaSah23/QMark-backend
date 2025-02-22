const errorResponse = require("../utility/ErrorResponse");

const asyncErrorHandler = (func) => {
    return (req, res, next) => {
        func(req, res, next).catch(err =>errorResponse(res,err));
    }
}

module.exports = asyncErrorHandler;