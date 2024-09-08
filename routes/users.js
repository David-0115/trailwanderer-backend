"use strict";

const jsonschema = require("jsonschema");
const express = require("express");
const router = new express.Router();
const userUpdateSchema = require('../schemas/userUpdate.json');
const { BadRequestError } = require('../expressError');
const { ensureCurrUser, ensureLoggedIn } = require("../middleware/auth");
const User = require("../models/User");



/**
 * GET /:username
 * Auth required: Logged in, current user only
 * Gets the user details for a given username. 
 * Returns: {id, username, firstName, lastName, email, profileImagePath}
 */
//TESTED
router.get('/:username', ensureCurrUser, async function (req, res, next) {
    try {
        const user = await User.findByUsername(req.params.username)
        delete user.passwordHash;
        return res.json({ user })
    } catch (e) {
        return next(e)
    }
});

/**
 * PATCH /:username
 * Auth required: Logged in, current user only
 * Update any of the user information - EXCEPT username.
 * Parameters: Object of any user information, can patch one or many user datapoints.
 * Returns : {id, username, firstName, lastName, email, profileImagePath, active, acctType, createdAt, updatedAt}
 */
//TESTED
router.patch('/:username', ensureCurrUser, async function (req, res, next) {
    try {
        const validator = jsonschema.validate(req.body, userUpdateSchema);
        if (!validator.valid) {
            const errors = validator.errors.map(e => e.stack);
            throw new BadRequestError(`Incorrect request format: ${errors}`);
        }

        const updatedUser = await User.handleUpdate(req.params.username, req.body);
        return res.json({ updatedUser });

    } catch (e) {
        return next(e)
    }
});

/**
 * DELETE /:username
 * Auth required: Logged in, current user only
 * Deletes the user account
 * Note: Database set to cascade on delete, wishlist & completed trails deleted also.
 * @returns {Object} {deleted: username}
 * @throws {NotFoundError} if username not found.
 * @throws {DatabaseError} if error with db transaction.
 */
//TESTED
router.delete('/:username', ensureCurrUser, async function (req, res, next) {
    try {
        const deletedUser = await User.delete(req.params.username)

        return res.json({ 'deleted': deletedUser })
    } catch (e) {
        return next(e)
    }
});

/**
 * POST /:username/wishlist/:trailId
 * Auth required: Logged in, current user only
 * Adds a trail to a users wishlist
 */
//TESTED
router.post('/:username/wishlist/:trailId', ensureCurrUser, async function (req, res, next) {
    try {
        const addedId = await User.addToWishList(res.locals.user.id, req.params.trailId)
        return res.json({ "addedId": addedId })
    } catch (e) {
        return next(e);
    }
});

/**
 * DELETE /:username/wishlist/:trailId
 * Auth required: Logged in, current user only
 * Deletes a trail from a users wishlist
 */
//TESTED
router.delete('/:username/wishlist/:trailId', ensureCurrUser, async function (req, res, next) {
    try {
        const deletedId = await User.deleteFromWishList(res.locals.user.id, req.params.trailId);
        return res.json({ "deletedId": deletedId });
    } catch (e) {
        return next(e);
    }
});

/**
 * GET /:username/wishlist
 * Auth required: Logged in, current user only
 * Gets list of trails on the users wishlist
 * @returns {Array of Objects} 
 * @example: "wishlist": [
        {
            "id": 2, // Trail id
            "name": "Trail 2",
            "city": "Anchorage",
            "state": "AK",
            "difficulty": "Moderate",
            "dogsAllowed": "Unknown",
            "description": "Description 2",
            "landManager": "Manager 2",
            "stats": {
                "type": "Out & Back",
                "distance": 4.2,
                "elevationHigh": 1500,
                "elevationLow": 1000,
                "elevationGain": 500,
                "elevationLoss": 250,
                "avgGradePercent": 6,
                "avgGradeDegree": 3.43,
                "maxGradePercent": 12,
                "maxGradeDegree": 6.86
            },
            "features": [
                "Waterfall",
                "Birding"
            ],
            "imagePaths": [
                "/path2/test",
                "/path2/img2/test"
            ]
        },....]
 */
//TESTED
router.get('/:username/wishlist', ensureCurrUser, async function (req, res, next) {
    try {
        const wishlist = await User.getWishList(res.locals.user.id)
        return res.json({ wishlist })
    } catch (e) {
        return next(e);
    }
});

/**
 * POST /:username/completed/:trailId 
 * Auth required: Logged in, current user only
 * Adds a trail id / user id to completed_trails table, signifiying a user has completed that trail.
 */
//TESTED
router.post('/:username/completed/:trailId', ensureCurrUser, async function (req, res, next) {
    try {
        const addedId = await User.addCompleted(res.locals.user.id, req.params.trailId);
        return res.json({ addedId })
    } catch (e) {
        return next(e);
    }
});

/**
 * DELETE /:username/completed/:trailId
 * Auth required: Logged in, current user only
 * Deletes a trail id / user id from completed_trails table. 
 */
//TESTED
router.delete('/:username/completed/:trailId', ensureCurrUser, async function (req, res, next) {
    try {
        const deletedId = await User.deleteCompleted(res.locals.user.id, req.params.trailId)
        return res.json({ deletedId })
    } catch (e) {
        return next(e);
    }
});

/**
 * GET /:username/completed
 * Auth required: Logged in, current user only
 * Gets trails from a users completed list
 * @returns {Array of Objects}
 * @example "completedList": [
        {
            "id": 5,
            "name": "Trail 5",
            "city": "Los Angeles",
            "state": "CA",
            "difficulty": "Challenging",
            "dogsAllowed": "Unknown",
            "description": "Description 5",
            "landManager": "Manager 5",
            "stats": {
                "type": "Loop",
                "distance": 3.8,
                "elevationHigh": 1250,
                "elevationLow": 850,
                "elevationGain": 400,
                "elevationLoss": 200,
                "avgGradePercent": 6,
                "avgGradeDegree": 3.43,
                "maxGradePercent": 12,
                "maxGradeDegree": 6.86
            },
            "features": [
                "Fall Colors",
                "Views",
                "Lake"
            ],
            "imagePaths": []
        },...]
 */
//TESTED
router.get('/:username/completed', ensureCurrUser, async function (req, res, next) {
    try {
        const completedList = await User.getCompleted(res.locals.user.id);
        return res.json({ completedList })
    } catch (e) {
        return next(e);
    }
});

router.get('/:username/stats', ensureCurrUser, async function (req, res, next) {
    try {
        const userStats = await User.getUserStats(res.locals.user.id);
        return res.json({ userStats })
    } catch (e) {
        next(e);
    }
})



module.exports = router;