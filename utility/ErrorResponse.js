const errorResponse = (res,error)=>{   
    console.log(error.message);
     
    const errResponse = {
        statusCode:error.statusCode||500,
        message:error.message||"Something went wrong",
        timestamp:new Date()
    }
    res.status(error.statusCode||500).json(errResponse);
}
module.exports = errorResponse;