"use strict"
const pool = require('../dbPool');
const { stateMap, jsToSqlFilters } = require('../helpers/objectMaps');
const Trail = require('./Trail')


/**
 * 
 * @param {string} searchTerm 
 * @param {number} page 
 * @param {number} limit 
 * @param {object} filters : 
 * Can contain any of these filters: {features :[array of features],city:string, state:string, type:string, dogsAllowed:string, minDistance:number, maxDistance:number,
 *                                   maxElevation:number, minElevation:number, maxElevationGain:number, minElevationGain:number, maxElevationLoss:number, minElevationLoss}
 * }
 * @param {string} unit  "Imperial"  || "Metric" 
 * @returns {array of trail objects}
 * @example Search: /trails/search?page=1&limit=10&filters={"type":"loop","city":"huntsville","state":"al","minDistance":2,"features":["waterfall","cave"]}
 * 
 * {
 *       "result": [
 *           {
 *               "id": 1,
 *               "name": "Trail 1",
 *               "city": "Huntsville",
 *               "state": "AL",
 *               "difficulty": "Easy",
 *               "dogsAllowed": "Unknown",
 *               "description": "Description 1",
 *               "landManager": "Manager 1",
 *               "stats": {
 *                   "type": "Loop",
 *                   "distance": 3.5,
 *                   "elevationHigh": 1200,
 *                   "elevationLow": 800,
 *                   "elevationGain": 400,
 *                   "elevationLoss": 200,
 *                   "avgGradePercent": 5,
 *                   "avgGradeDegree": 2.86,
 *                   "maxGradePercent": 10,
 *                   "maxGradeDegree": 5.71
 *               },
 *               "features": [
 *                   "Cave",
 *                   "Waterfall",
 *                   "Wildflowers"
 *               ],
 *               "imagePaths": [
 *                   "/path1/test"
 *               ]
 *           }
 *       ]
 *   }
 */
const searchTrails = async (searchTerm, page = 1, limit = 10, filters = null, userId, unit = "Imperial",) => {

    const db = await pool.connect();
    try {
        let offset = (page - 1) * limit;
        let params = [];
        let paramCount = 0;

        const addParam = (param) => {
            params.push(param);
            paramCount++;
            return `$${paramCount}`;
        };

        let baseQuery = `
            SELECT DISTINCT
                t.id
            FROM trails t
            LEFT JOIN trail_features tf ON t.id = tf.trail_id
            LEFT JOIN features f ON tf.feature_id = f.id
            LEFT JOIN trail_stats ts ON t.id = ts.trail_id
        `;

        let whereClause = ` WHERE 1=1 `;

        if (searchTerm) {
            const sanitizedSearchTerm = searchTerm
                .split(' ')
                .filter(word => word.trim() !== '')
                .map(word => word.replace(/[^\w\s]/gi, ''))
                .join(' & ');

            const searchParam = addParam(`%${sanitizedSearchTerm}%`);
            // whereClause += ` AND (t.name ILIKE ${searchParam} OR t.city ILIKE ${searchParam} OR t.state ILIKE ${searchParam}) `;
            whereClause += ` AND to_tsvector('english', t.name || ' ' || t.city || ' ' || t.state) @@ to_tsquery('english', ${searchParam}) `;
        }

        if (filters) {
            for (let key of Object.keys(filters)) {
                if (key === "features") {
                    if (!Array.isArray(filters.features)) {
                        throw new Error('Features filter must be an array');
                    }
                    const featuresParam = addParam(filters.features);
                    whereClause += `
                        AND t.id IN (
                            SELECT tf.trail_id
                            FROM trail_features tf
                            JOIN features f ON tf.feature_id = f.id
                            WHERE f.feature_name = ANY(${featuresParam}::text[])
                            GROUP BY tf.trail_id
                            HAVING COUNT(DISTINCT LOWER(f.feature_name)) = ${filters.features.length}
                        ) `;
                } else if (key === "difficulty") {
                    const difficultyParam = addParam(filters.difficulty);
                    whereClause += `
                        AND t.difficulty = ANY(${difficultyParam}::text[])
                    `
                } else if (key === "type") {
                    const typeParam = addParam(filters.type)
                    whereClause += `
                        AND ts.type = ANY(${typeParam}::text[])
                    `
                } else if (["minDistance", "maxDistance"].includes(key)) {
                    if (!filters[key]) continue;
                    whereClause += addDistanceFilters(key, filters, addParam, jsToSqlFilters, unit);

                } else if (["minElevation", "maxElevation", "minElevationLoss", "maxElevationLoss", "minElevationGain", "maxElevationGain"].includes(key)) {
                    if (!filters[key]) continue;
                    whereClause += addElevationFilters(key, filters, addParam, jsToSqlFilters, unit);

                } else {
                    if (jsToSqlFilters.get(key)) {
                        const paramNum = addParam(filters[key]);
                        Number(filters[key]) != NaN
                            ? whereClause += `AND ${jsToSqlFilters.get(key)} = ${paramNum}`
                            : whereClause += `AND LOWER (${jsToSqlFilters.get(key)}) = ${paramNum}`
                    }
                }
            }
        }

        const countQuery = `SELECT COUNT(DISTINCT t.id) AS total_count FROM trails t 
            LEFT JOIN trail_features tf ON t.id = tf.trail_id 
            LEFT JOIN features f ON tf.feature_id = f.id 
            LEFT JOIN trail_stats ts ON t.id = ts.trail_id 
            ${whereClause}`;


        const countResult = await db.query(countQuery, params);
        const totalCount = countResult.rows[0].total_count;

        const limitParam = addParam(limit);
        const offsetParam = addParam(offset);

        const finalQuery = `${baseQuery}${whereClause} LIMIT ${limitParam} OFFSET ${offsetParam}`;


        const result = await db.query(finalQuery, params);

        if (result.rows.length > 0) {
            const trails = await Trail.getFullTrailsByIds(result.rows.map(row => Number(row.id)), userId);
            return {
                totalCount: totalCount,
                trails: trails
            };
        } else {
            return {
                totalCount: totalCount,
                trails: []
            };
        }

    } catch (e) {
        console.error(e);
        throw new Error('Error executing search query');
    } finally {
        db.release();
    }
};


// minElevation, maxElevation
// minElevationGain, maxElevationGain
// minElevationLoss, maxElevationLoss
const addElevationFilters = (key, filters, addParam, jsToSqlFilters, unit) => {
    const elevType = key.startsWith("min") ? "min" : "max";
    const filterParam = elevType === "min" ? ">" : "<"
    const currentKey = `${key}${unit}`;
    const currentSqlKey = jsToSqlFilters.get(currentKey);

    if (!currentSqlKey) {
        throw new Error(`Invalid filter key: ${key}`);
    }

    const currentParam = addParam(filters[key]);

    return ` AND ${currentSqlKey} ${filterParam}= ${currentParam} `

};


// minDistance:number, maxDistance:number
const addDistanceFilters = (key, filters, addParam, jsToSqlFilters, unit) => {
    const distType = key.startsWith("min") ? "min" : "max";
    const currentKey = `${distType}Distance${unit}`;
    const nextKey = distType === "min" ? `maxDistance${unit}` : `minDistance${unit}`;
    const currentSqlKey = jsToSqlFilters.get(currentKey);
    const nextSqlKey = jsToSqlFilters.get(nextKey);
    const noUnitCurKey = currentKey.slice(0, 11);
    const noUnitNextKey = nextKey.slice(0, 11)


    if (!currentSqlKey || !nextSqlKey) {
        throw new Error(`Invalid filter key: ${key}`);
    }

    if (filters[nextKey]) {
        if (filters[noUnitCurKey] > filters[noUnitNextKey]) {
            [filters[noUnitCurKey], filters[noUnitNextKey]] = [filters[noUnitNextKey], filters[noUnitCurKey]];
        }

        const currentParam = addParam(filters[noUnitCurKey]);
        const nextParam = addParam(filters[noUnitNextKey]);


        delete filters[noUnitCurKey];
        delete filters[noUnitNextKey];

        return ` AND ${currentSqlKey} BETWEEN ${currentParam} AND ${nextParam} `;
    } else {
        const currentParam = addParam(filters[noUnitCurKey]);
        delete filters[noUnitCurKey];

        return distType === "min"
            ? ` AND ${currentSqlKey} >= ${currentParam} `
            : ` AND ${nextSqlKey} <= ${currentParam} `;
    }
};


module.exports = {
    searchTrails
};





// static async search(searchTerm, page = 1, limit = 10, filters = null) {
//     const db = await pool.connect();
//     try {

//         let offset = (page - 1) * limit;
//         let params = [];
//         let paramCount = 0;
//         let paramString = ""
//         const addParam = (param) => {
//             params.push(param)
//             paramCount++
//             paramString += `$${paramCount},`
//         }
//         let baseQuery = `
//             SELECT 
//                 t.id
//             FROM trails t
//             LEFT JOIN trail_features tf ON t.id = tf.trail_id
//             LEFT JOIN features f ON tf.feature_id = f.id
//             LEFT JOIN trail_stats ts ON t.id = ts.trail_id
//         `
//         let whereClause = ` WHERE `

//         if (searchTerm) {
//             addParam(`%${searchTerm}%`);
//             whereClause += ` (t.name ILIKE $1 OR t.city ILIKE $1 OR t.state ILIKE $1) `
//         }

//         if (filters) {
//             if (paramCount > 0) {
//                 whereClause += ` AND`
//             }

//             for (let key of Object.keys(filters)) {
//                 if (key === "features") {
//                     addParam(filters.features)
//                     whereClause += ` t.id IN(
//                         SELECT tf.trail_id
//                         FROM trail_features tf
//                         JOIN features f ON tf.feature_id = f.id
//                         WHERE f.feature_name = ANY($${paramCount}::text[])
//                         GROUP BY tf.trail_id
//                         HAVING COUNT(DISTINCT f.feature_name) = ${filters.features.length}
//                     ) `;
//                 }


//                 if (key === "minDistanceImperial" || key === "maxDistanceImperial" || key === "minDistanceMetric" || key === "maxDistanceMetric") {
//                     const unit = key[key.length - 1] === "l" ? "Imperial" : "Metric";
//                     const distType = key.slice(0, 3)
//                     let currentKey = distType === "min" ? `minDistance${unit}` : `maxDistance${unit}`;
//                     let nextKey = distType === "min" ? `maxDistance${unit}` : `minDistance${unit}`;
//                     if (filters[nextKey]) {
//                         if(filters[currentKey] > filters[nextKey]) {
//                             let temp = currentKey;
//                             currentKey = nextKey;
//                             nextKey = temp;
//                         }
//                         addParam(filters[currentKey])
//                         addParam(filters[nextKey])
//                         whereClause += `AND ${jsToSqlFilters[currentKey]} >=${paramCount - 1} AND ${jsToSqlFilters[nextKey]} <= ${paramCount}`

//                     } else if (distType === "min") {
//                         addParam(filters[currentKey])
//                         whereClause += ` AND ${jsToSqlFilters[currentKey]} >=${paramCount} `
//                     } else {
//                         addParam(filters[currentKey])
//                         whereClause += `AND ${jsToSqlFilters[nextKey]} <= ${paramCount}`
//                     }
//                 }



//             }

//             // addParam(filters[key])
//             //     whereClause += ` AND ${jsToSqlFilters[key]} = ANY($${paramCount}::text[]) `

//             // }(key === "minDistanceImperial" || key === "maxDistanceImperial" || key === "minDistanceMetric" || key==="maxDistanceMetric")
//         }

//     } catch (e) {

//     } finally {
//         db.release()
//     }
// }

// /**
// * Searches trails based on a search term and various filters.
// *
// * @param {string} searchTerm - The term to search for in trail names, cities, and states.
// * @param {Object} filters - The filters to apply to the search. Can include:
// *   @param {Array<string>} [filters.features] - An array of feature names to filter by.
// *   @param {Array<string>} [filters.difficulty] - An array of difficulty levels to filter by.
// *   @param {Object} [filters.distance] - An object containing distance filter information.
// *     @param {number} [filters.distance.dist] - The maximum distance to filter by.
// *     @param {string} [filters.distance.unit] - The unit of distance, either "imperial" or "metric".
// *   @param {boolean} [filters.dogs] - A boolean indicating whether to filter by dog-friendly trails.
// * @param {number} [page=1] - The page number for pagination.
// * @param {number} [limit=10] - The number of results to return per page.
// * @returns {Promise<Array<Object>>} A promise that resolves to an array of trail objects matching the search criteria.
// * @throws {DatabaseError} If there is an error executing the search query.
// */
// static async search(searchTerm, page = 1, limit = 10, filters = null) {
//     const db = await pool.connect();
//     try {

//         let offset = (page - 1) * limit;
//         let query = `
//             SELECT t.id, t.name, t.city, t.state, t.difficulty, t.dogs_allowed, array_agg(f.feature_name) AS features, 
//                 MIN(s.distance_imperial) AS distance_imperial, MIN(s.distance_metric) AS distance_metric
//             FROM trails t
//             LEFT JOIN trail_features tf ON t.id = tf.trail_id
//             LEFT JOIN features f ON tf.feature_id = f.id
//             LEFT JOIN trail_stats s ON t.id = s.trail_id
//             WHERE (t.name ILIKE $1 OR t.city ILIKE $1 OR t.state ILIKE $1)`;

//         let queryParams = [`%${searchTerm}%`];
//         let paramCount = queryParams.length;

//         // Adding feature filters dynamically
//         if (filters && filters.features && filters.features.length > 0) {
//             paramCount++;
//             query += ` AND t.id IN (
//             SELECT tf.trail_id
//             FROM trail_features tf
//             JOIN features f ON tf.feature_id = f.id
//             WHERE f.feature_name = ANY($${paramCount}::text[])
//             GROUP BY tf.trail_id
//             HAVING COUNT(DISTINCT f.feature_name) = ${filters.features.length}
//     )`;
//             queryParams.push(filters.features);
//         }

//         // Adding difficulty filters dynamically
//         if (filters && filters.difficulty && filters.difficulty.length > 0) {
//             paramCount++;
//             query += ` AND t.difficulty = ANY($${paramCount}::text[])`;
//             queryParams.push(filters.difficulty);
//         }

//         // Adding distance filter dynamically
//         if (filters && filters.distance) {
//             const distanceColumn = filters.distance.unit === 'metric' ? 'distance_metric' : 'distance_imperial';
//             paramCount++;
//             query += ` AND s.${distanceColumn} <= $${paramCount}`;
//             queryParams.push(filters.distance.dist);
//         }

//         // Adding dogs filter dynamically
//         if (filters && typeof filters.dogs === 'boolean') {
//             paramCount++;
//             query += ` AND t.dogs_allowed = $${paramCount}`;
//             queryParams.push(filters.dogs);
//         }

//         query += ` GROUP BY t.id, t.name, t.city, t.state, t.difficulty, t.dogs_allowed`;
//         query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
//         queryParams.push(limit, offset);

//         // Execute the query
//         const result = await db.query(query, queryParams);
//         return result.rows;
//     } catch (e) {
//         console.error(e)
//     } finally {
//         db.release();
//     }

// }