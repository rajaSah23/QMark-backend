class CustomError extends Error{
    constructor(statusCode,message){
        super(message);
        this.status= statusCode>=400 && statusCode<500 ? "failed":"success";
        this.statusCode=statusCode;
        this.message=message;
    };


}

module.exports = CustomError;

// const error = new CustomError("Some rrr msg","404")