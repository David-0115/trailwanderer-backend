//static methods for User creation, authentication, validation

"use strict";

const pool = require("../dbPool")
const argon2 = require("argon2");
const {
    NotFoundError,
    BadRequestError,
    UnauthorizedError,
    DatabaseError
} = require("../expressError");

const { sqlForPartialUpdate } = require("../helpers/sql")
const Trail = require("./Trail");
const User = require("./User");
const OAuthProvider = require('./OAuthProvider');

class UserService {
    static async findOrCreateOIDCUser(obj) {

        const { providerName, providerUserId, email, firstName, lastName, profileImagePath, accessToken, refreshToken } = obj

        let user = await User.findByEmail(email);
        if (!user) {
            user = await User.create({
                username: email.split('@')[0],
                firstName,
                lastName,
                email,
                profileImagePath,
                acctType: 'oauth'
            });
        }

        let oauthProvider = await OAuthProvider.findByUserIdAndProvider(user.id, providerName);

        if (!oauthProvider) {
            oauthProvider = await OAuthProvider.create({
                userId: user.id,
                providerName,
                providerUserId,
                accessToken,
                refreshToken
            });

        } else {
            oauthProvider.accessToken = accessToken;
            oauthProvider.refreshToken = refreshToken;
            oauthProvider = await OAuthProvider.update(oauthProvider);

        }

        return user;
    }
}


module.exports = UserService;