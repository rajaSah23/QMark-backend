const Token = require("../db/model/Token");


class TokenRepository {
    async findOne(condition) {
        console.log("TokenRepository", condition);

        return await Token.findOne(condition);
    }

    async updateOrCreate(userId, data) {
        console.log("Token repo:", data);

        return await Token.findOneAndUpdate({ userId: userId }, { $set: data }, { new: true, upsert: true });
    }
    async delete(id) {
        return await Token.findByIdAndDelete(id);
    }
}

module.exports = new TokenRepository();