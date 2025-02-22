const successResponse = (statusCode,data,message)=>{
    return {
        statusCode : statusCode||200,
        data:data||null,
        message:message||"data sent successfully"
    }
}

module.exports ={successResponse};