const User = require("../db/model/User");

class UserRepository {
    async createUser (userData){        
        const user = await User.create(userData);
        return user;
    }
    async updateUserById (userId,userData){        
        const user = await User.findByIdAndUpdate(userId,userData,{new:true});
        return user;
    }

    async findByEmail(email){
        const user = await User.findOne({email:email});
        return user;
    }

    async findById(userId){
        const user = await User.findById(userId);
        return user;
    }

}

module.exports = new UserRepository();