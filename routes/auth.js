"use strict";
require("dotenv").config();
const jsonschema = require("jsonschema");
const passport = require('passport');
const express = require("express");
const router = new express.Router();
const userAuthSchema = require('../schemas/userAuth.json');
const newUserSchema = require('../schemas/newUser.json');
const { createToken } = require('../helpers/tokens');
const { BadRequestError } = require('../expressError')
const User = require('../models/User');
const UserService = require("../models/UserService");

/**
 * POST /auth/login {username, password} => {token}
 * 
 * Returns JWT token to authenticate future requests
 * 
 * Auth required: none
 */


router.post("/login", async function (req, res, next) {
    try {
        const validator = jsonschema.validate(req.body, userAuthSchema);
        if (!validator.valid) {
            const errors = validator.errors.map(e => e.stack);
            throw new BadRequestError(`Incorrect request format: ${errors}`)
        }

        const { username, password } = req.body;
        const user = await User.authenticate(username, password);
        const token = createToken(user);
        return res.json({ token });
    } catch (e) {
        return next(e);
    }

});

/**
 * POST /auth/register  {username, password, firstName, lastName, email ,profileImgPath} => { token }
 * 
 * Registers a user, returns a token for future authentications
 * 
 * Auth required: none 
 */


router.post("/register", async function (req, res, next) {
    try {
        const validator = jsonschema.validate(req.body, newUserSchema);
        if (!validator.valid) {
            const errors = validator.errors.map(e => e.stack);
            throw new BadRequestError(`Incorrect request format: ${errors}`)
        }
        const profPath = req.body.profileImagePath
            ? req.body.profileImagePath
            : "/src/assets/profile-placeholder.png"

        req.body.profileImagePath = profPath;
        req.body.acctType = "local";
        const newUser = await User.create({ ...req.body });
        const token = createToken(newUser);
        return res.status(201).json({ token });
    } catch (e) {
        return next(e);
    }
});


// Google Authentication routes

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
    passport.authenticate('google', { session: false, scope: ['profile', 'email'] }),
    async (req, res) => {
        try {
            if (!req.user) {
                console.error("Google callback: Authentication failed, no user returned");
                return res.status(401).json({ error: 'Authentication failed' });
            }

            //Note: this clears the provider accessToken in the oauth_providers table, if token is needed in the future 
            //code will need to be adjusted here and in the OauthProviders.update method.

            req.user.providerName = 'google'
            const user = await UserService.findOrCreateOIDCUser(req.user);
            const token = createToken(user)
            user.token = token
            const encodedUser = encodeURIComponent(JSON.stringify(user));
            res.redirect(`${process.env.FRONTEND_URL}/oauth?user=${encodedUser}`)
        } catch (e) {
            console.error("Google callback: Error in callback handler:", e.message);
            res.status(500).json({ error: 'Internal Server Error' });
        }

    }
);


// Facebook Authentication routes

router.get('/facebook', passport.authenticate('facebook', { scope: ['email', 'public_profile'] }));

router.get('/facebook/callback',
    passport.authenticate('facebook', { session: false }),
    async (req, res) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication failed' });
        }
        req.user.providerName = 'facebook'
        const user = await UserService.findOrCreateOIDCUser(req.user);
        const token = createToken(user)
        user.token = token
        const encodedUser = encodeURIComponent(JSON.stringify(user));
        res.redirect(`${process.env.FRONTEND_URL}/oauth?user=${encodedUser}`)
    }
);

router.post('testing/:bool', async function (req, res, next) {
    console.log(req.params.bool)
    if (req.params.bool === true) {
        process.env.NODE_ENV = "test"
        return res.json({ 'mode': 'test' })
    } else {
        process.env.NODE_ENV = "production"
        return res.json({ 'mode': 'production' })
    }
});

// Amazon Authentication routes - Amazon Oauth not implemented (awaiting Amazon acct set-up)
// router.get('/amazon', passport.authenticate('amazon', { scope: ['profile', 'postal_code'] }));

// router.get('/amazon/callback',
//     passport.authenticate('amazon', { session: false }),
//     async (req, res) => {
//         if (!req.user) {
//             return res.status(401).json({ error: 'Authentication failed' });
//         }
//         const user = await UserService.findOrCreateOIDCUser(req.user);

//         res.json({ user });
//     }
// );

module.exports = router;