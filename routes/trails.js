const jsonschema = require("jsonschema");
const express = require("express");
const router = new express.Router();
const newTrailSchema = require('../schemas/newTrail.json');
const updateTrailSchema = require('../schemas/updateTrail.json');
const Trail = require('../models/Trail');
const { searchTrails } = require('../models/TrailSearch');
const { ensureCurrUser, ensureLoggedIn } = require("../middleware/auth");
const { searchTrailByName } = require('../helpers/maps')

/**
 * GET /search
 * Auth required: None
 * Returns a list of trails that meet the search parameters
 */
router.get('/search', async function (req, res, next) {
    try {

        const { searchTerm, page, limit } = req.query
        const filters = req.query.filters ? JSON.parse(req.query.filters) : null

        const result = await searchTrails(searchTerm, page, limit, filters, userId = null)


        return res.json({ result });
    } catch (e) {
        console.error(e);
        return next(e);
    }

});

/**
 * GET /search/username
 * Auth required: current logged in user
 * Passes the current user to searchTrails which adds in wishlist and completed data
 * to the result. 
 */
router.get('/search/:username', ensureCurrUser, async function (req, res, next) {
    try {

        const { searchTerm, page, limit } = req.query
        const filters = req.query.filters ? JSON.parse(req.query.filters) : null
        const userId = res.locals.user.id
        const result = await searchTrails(searchTerm, page, limit, filters, userId)


        return res.json({ result });
    } catch (e) {
        console.error(e);
        return next(e);
    }

});


/**
 * GET /trails/ids
 * Auth required: None
 * 
 */
router.get('/:id', async function (req, res, next) {
    try {
        const trail = await Trail.getFullTrailsByIds([req.params.id])
        return res.json({ trail })
    } catch (e) {
        console.error(e)
        return next(e);
    }
});

router.get('/coords/:ids', async function (req, res, next) {
    try {
        const coords = await Trail.getTrailCoordsByIds([req.params.ids])
        return res.json({ coords })
    } catch (e) {
        return next(e);
    }
})

router.get('/:id/:username', ensureCurrUser, async function (req, res, next) {
    try {
        const userId = res.locals.user.id
        const trail = await Trail.getFullTrailsByIds([req.params.id], userId)
        return res.json({ trail })
    } catch (e) {
        console.error(e)
        return next(e);
    }
});

router.post('/map', async function (req, res, next) {
    try {
        const { trailName, state } = req.body
        const resp = await searchTrailByName(trailName, state);
        return res.json({ resp })
    } catch (e) {
        return next(e);
    }

})



module.exports = router;


//URL-Encoded - http://localhost:3001/trails/search?page=1&limit=10&filters=%7B%22minDistanceImperial%22%3A2%2C%22maxDistanceImperial%22%3A10%7D
//URL- unencoded - http://localhost:3001/trails/search?page=1&limit=10&filters={"minDistanceImperial":2,"maxDistanceImperial":10}

