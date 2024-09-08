"use strict"

const pool = require("../dbPool")
const wkx = require('wkx');
const {
    NotFoundError,
    BadRequestError,
    DatabaseError
} = require("../expressError");

const { sqlForPartialUpdate } = require("../helpers/sql");
const User = require("./User");



class Trail {

    /**
   * Retrieves the full details of a trail by its ID, including stats and features.
   *
   * @param {number} trailId - The ID of the trail to retrieve.
   * @returns {Promise<Object>} A promise that resolves to an object containing the trail details, including stats and features.
   * @throws {NotFoundError} If the trail with the specified ID is not found.
   * @throws {DatabaseError} If there is an error retrieving the trail data from the database.
   */
    static async getFullTrailsByIds(rawTrailIds, userId = null) {

        const db = await pool.connect();
        try {
            const trailIds = rawTrailIds.map((id) => {
                if (isNaN(Number(id))) {
                    throw new BadRequestError("Trail ids must be a number.")
                } else {
                    return Number(id)
                }
            });

            const trailResult = await db.query(`
            SELECT id,
                    name,
                    city,
                    state,
                    difficulty,
                    dogs_allowed AS "dogsAllowed",
                    description,
                    land_manager AS "landManager"
            FROM trails WHERE id = ANY($1::int[])
        `, [trailIds]);

            const trails = trailResult.rows;

            if (trails.length > 0) {
                const trailAttributes = await Promise.all([
                    this.getStatsByIds(trailIds),
                    this.getTrailFeaturesByIds(trailIds),
                    this.getTrailImagesByIds(trailIds),
                    this.getTrailCoordsByIds(trailIds),
                    userId ? User.isOnWishList(userId, trailIds) : Promise.resolve(null),
                    userId ? User.isOnCompletedList(userId, trailIds) : Promise.resolve(null)
                ]);

                const statsMap = new Map(trailAttributes[0].map(stat => [stat.trail_id, stat]));
                const featuresMap = new Map(trailAttributes[1].map(feature => [feature.trail_id, feature.features]));
                const imagesMap = new Map(trailAttributes[2].map(image => [image.trail_id, image.paths]));
                const coordMap = trailAttributes[3] && trailAttributes[3].length > 0
                    ? new Map(trailAttributes[3].map(coord => [coord.trail_id, coord.geojson.coordinates]))
                    : null;

                const wishListMap = userId && trailAttributes[4] && trailAttributes[4].length > 0
                    ? new Map(trailIds.map(id => (
                        trailAttributes[4].includes(id) ? [id, true] : [id, false]
                    )))
                    : null;

                const completedListMap = userId && trailAttributes[5] && trailAttributes[5].length > 0
                    ? new Map(trailIds.map(id => (
                        trailAttributes[5].includes(id) ? [id, true] : [id, false]
                    )))
                    : null;

                trails.forEach(trail => {
                    trail.stats = statsMap.get(trail.id) || {};
                    delete trail.stats.trail_id;
                    trail.features = featuresMap.get(trail.id) || [];
                    delete trail.features.trail_id;
                    trail.imagePaths = imagesMap.get(trail.id) || [];
                    delete trail.imagePaths.trail_id;
                    trail.coordinates = coordMap ? coordMap.get(trail.id) : [];
                    trail.isWishList = wishListMap ? wishListMap.get(trail.id) : false;
                    trail.isComplete = completedListMap ? completedListMap.get(trail.id) : false;
                });

                return trails;
            } else {
                throw new NotFoundError(`No trails found for the provided IDs`)
            }


        } catch (e) {
            console.error(e);
            if (e instanceof NotFoundError || e instanceof BadRequestError) {
                throw e;
            }
            throw new DatabaseError(`Error retrieving trail by id: ${e.message}`);
        } finally {
            db.release();
        }
    }

    // 

    /**
     * Used to confirm a trail record exists in the database. 
     * @param {number} trailId 
     * @returns {true} or throws error
     * @throws {NotFoundError} if trailId is not found
     */
    static async verifyTrailExists(trailId) {
        const db = await pool.connect();
        try {
            const result = await db.query(`
                    SELECT id FROM trails WHERE id = $1
                `, [trailId])

            if (result.rows.length > 0) {
                return true;
            } else {
                throw new NotFoundError(`Trail id ${trailId} not found`)
            }
        } catch (e) {
            console.error(e)
        } finally {
            db.release()
        }
    }

    //             ***********TRAIL COORDS************
    static async getTrailCoordsByIds(trailIds) {
        const db = await pool.connect();
        try {
            const result = await db.query(`
                    SELECT trail_id, polyline FROM trail_polylines
                    WHERE trail_id = ANY($1::int[])
                `, [trailIds])

            if (result.rows.length > 0) {
                const geojson = this.linestringToGeoJSON(result.rows)
                return geojson;
            } else {
                return
            }
        } catch (e) {
            console.error(e);

        } finally {
            db.release()
        }
    }

    static async linestringToGeoJSON(dataArr) {

        const coordArray = dataArr.map((dataObj) => {

            const wkbHex = dataObj.polyline;
            const wkbBuffer = Buffer.from(wkbHex, 'hex');
            const geometry = wkx.Geometry.parse(wkbBuffer);
            const geojson = geometry.toGeoJSON();
            const data = {
                trail_id: dataObj.trail_id,
                geojson: geojson
            }
            return data;
        })

        return coordArray;
    }

    //              **********TRAIL STATS*************



    /**
     * Retrieves the statistics of a trail by its ID and system of measurement.
     *
     * @param {number} trail_id - The ID of the trail whose stats are to be retrieved.
     * @param {string} [systemOfMeasure="imperial"] - The system of measurement to use ("imperial" or "metric").
     * @returns {Promise<Object>} A promise that resolves to an object containing the trail's statistics.
     * @throws {NotFoundError} If the trail with the specified ID is not found.
     * @throws {DatabaseError} If there is an error retrieving the trail stats from the database.
     */
    static async getStatsByIds(trail_ids, systemOfMeasure = "imperial") {
        const db = await pool.connect();
        const som = systemOfMeasure;
        try {
            const result = await db.query(`
            SELECT trail_id,
                   type,
                   distance_${som} AS "distance",
                   elevation_high_${som} AS "elevationHigh",
                   elevation_low_${som} AS "elevationLow",
                   elevation_gain_${som} AS "elevationGain",
                   elevation_loss_${som} AS "elevationLoss",
                   avg_grade_percent AS "avgGradePercent",
                   avg_grade_degree AS "avgGradeDegree",
                   max_grade_percent AS "maxGradePercent",
                   max_grade_degree AS "maxGradeDegree"
            FROM trail_stats
            WHERE trail_id = ANY($1::int[])`,
                [trail_ids]
            );

            return result.rows;

        } catch (e) {
            console.error(e);
            throw new DatabaseError(`Error retrieving stats by ids: ${e.message}`);
        } finally {
            db.release();
        }
    }

    //             ****************TRAIL FEATURES*******************

    /**
     * Retrieves the features of a trail by its ID.
     *
     * @param {number} trailId - The ID of the trail whose features are to be retrieved.
     * @returns {Promise<Array<string>>} A promise that resolves to an array of feature names.
     * @throws {DatabaseError} If there is an error retrieving the trail features from the database.
     */
    static async getTrailFeaturesByIds(trailIds) {
        const db = await pool.connect();
        try {
            const result = await db.query(`
            SELECT
              trail_id,
              array_agg(f.feature_name) AS features
            FROM trail_features tf
            JOIN features f ON tf.feature_id = f.id
            WHERE tf.trail_id = ANY($1::int[])
            GROUP BY tf.trail_id`,
                [trailIds]
            );

            return result.rows

        } catch (e) {
            console.error('Error fetching trail features:', e);
            throw new DatabaseError('Error fetching trail features: ' + e.message);
        } finally {
            db.release();
        }
    }


    /**
     * Fetches a feature id from the database from the feature's name.
     * 
     * @param {string} feature Name of feature to search
     * @returns {number} feature_id.
     * @throws {NotFoundError} If feature name not found.
     * @throws {DatabaseError} If error retrieving feature_id.
     */
    static async getFeatureByName(feature) {
        const db = await pool.connect();
        try {
            const result = await db.query(`
                    SELECT id FROM features
                    WHERE feature_name = $1
                `, [feature])

            if (result.rows.length > 0) {
                return result.rows[0].id
            } else {
                throw new NotFoundError(`Feature ${feature} not found.`)
            }
        } catch (e) {
            console.error(e);
            if (e instanceof NotFoundError) {
                throw e;
            }
            throw new DatabaseError(`Error fetching feature by name: ${e.message}`)
        } finally {
            db.release();
        }
    }


    //             ***************TRAIL IMAGES***************


    /**
     * Gets image paths associated with a trail id from the trail_images table. 
     * @param {number} trailId 
     * @returns {array} imagePaths  ['/image/path/1', '/image/path/2'...]
     */
    static async getTrailImagesByIds(trailIds) {
        const db = await pool.connect();
        try {
            const result = await db.query(`
                SELECT trail_id, array_agg(path) AS paths
                FROM trail_images
                WHERE trail_id = ANY($1::int[])
                GROUP BY trail_id
            `, [trailIds]);

            return result.rows;
        } catch (e) {
            console.error(e);
            throw new DatabaseError(`Error retrieving trail images by id: ${e.message}`);
        } finally {
            db.release();
        }
    }

    // ***************The below methods are currently not in use -> Implement for users to add trails / update...***************
    //     /**  
    //          TODO: Update how features are handled, need to see if they exist..
    //    * Adds a new trail, stats and features to the database, returns trail.
    //    * 
    //    * @param {object} trail_data - full trail object
    //    * @returns {object} full trail object
    //    * @throws {BadRequestError} If the trail already exists.
    //    * @throws {DatabaseError} If there is an error saving to the database.
    //    */
    //     static async addTrail(trail_data) {
    //         const db = await pool.connect();
    //         try {
    //             //Does trail exist already? Yes: throw error / No: create trail
    //             await db.query('BEGIN')

    //             const isExistingTrailResult = await db.query(`
    //                 SELECT id FROM trails WHERE name = $1
    //             `, [trail_data.trailName])

    //             if (isExistingTrailResult[0]) {
    //                 throw new BadRequestError("Trail already exists. If information needs to be updated, please suggest an edit instead.")
    //             }

    //             const
    //                 {
    //                     trailName,
    //                     city,
    //                     state,
    //                     difficulty,
    //                     dogs,
    //                     description,
    //                     landManager,
    //                     stats,
    //                     features
    //                 } = trail_data;

    //             const trailInsert = await db.query(`
    //                     INSERT INTO trails
    //                         (
    //                             name,
    //                             city,
    //                             state,
    //                             difficulty,
    //                             dogs_allowed,
    //                             description,
    //                             land_manager
    //                         )
    //                     VALUES ($1,$2,$3,$4,$5,$6,$7)
    //                     RETURNING id  
    //                 `, [trailName, city, state, difficulty, dogs, description, landManager])

    //             const trailId = trailInsert.rows[0].id

    //             const addStatsFeatures = await Promise.all(
    //                 [...features.map((feature) => this.addFeature(feature)),
    //                 this.addTrailStats(stats, trailId)]
    //             );

    //             await db.query('COMMIT')
    //             return trailId

    //         } catch (e) {
    //             await db.query('ROLLBACK');
    //             console.error(e);
    //             if (e instanceof BadRequestError) {
    //                 throw e;
    //             }
    //             throw new DatabaseError(`Error adding trail: ${e.message}`)
    //         } finally {
    //             db.release();
    //         }

    //     }

    /**
//  * Given a full trail object it updates any single data point up to all datapoints for a trail.
//  * 
//  * @param {object} trailData - object of trail data to update.
//  * @param {number} trailId - Id of trail to update
//  * @returns {object} - Full trail object with the updated data.
//  * @throws {NotFoundError} I trailId is not found.
//  * @throws {DatabaseError} If trail update fails to save. 
//  */
    //     static async updateTrail(trailData, trailId) {
    //         const db = await pool.connect();
    //         try {
    //             const isTrailQuery = await db.query(`
    //                         SELECT id FROM trails
    //                         WHERE id = $1
    //                     `[trailId])

    //             const isTrailQueryResult = isTrailQuery.rows
    //             if (isTrailQueryResult.length === 0) {
    //                 throw new NotFoundError(`Trail id ${trailId} not found.`)
    //             }

    //             if (trailData.stats) {
    //                 await this.updateTrailStats(trailData.stats, trailId)
    //                 delete (trailData.stats)
    //             }

    //             if (trailData.features) {
    //                 await this.updateTrailFeatures(trailData.features, trailId)
    //                 delete (trailData.features)
    //             }

    //             if (trailData) {
    //                 const { setCols, values } = sqlForPartialUpdate(trailData)
    //                 const trailIdIdx = "$" + (values.length + 1)

    //                 const query = `UPDATE trails
    //                                    SET ${setCols}
    //                                    WHERE id = ${trailIdIdx}
    //                                    RETURNING id
    //                     `;
    //                 const result = await db.query(query, [...values, trailId])
    //                 await db.query('COMMIT')
    //             }

    //             const updatedTrail = await this.getFullTrailById(trailId);
    //             return updatedTrail

    //         } catch (e) {
    //             await db.query('ROLLBACK')
    //             console.error(e);
    //             if (e instanceof NotFoundError) {
    //                 throw e;
    //             }
    //             throw new DatabaseError(`Trail ${trail_id} update did not process: ${e.message}`)
    //         } finally {
    //             db.release();
    //         }
    //     }

    //     static async deleteTrail(trail_id) {
    //         const db = await pool.connect();
    //         try {

    //         } catch (e) {
    //             console.error(e)
    //         } finally {
    //             db.release();
    //         }
    //     }

    // /**
    // * Adds stats to an existing trail.
    // * 
    // * @param {object} stats 
    // * @param {number} trailId 
    // * @throws {DatabaseError} If trail stats are not saved.
    // */
    // static async addTrailStats(stats, trailId) {
    //     const db = await pool.connect();
    //     try {
    //         const statInsert = await db.query(`
    //             INSERT INTO trail_stats 
    //                 (
    //                     trail_id,
    //                     type,
    //                     distance_imperial,
    //                     distance_metric,
    //                     elevation_high_imperial,
    //                     elevation_high_metric,
    //                     elevation_low_imperial,
    //                     elevation_low_metric,
    //                     elevation_gain_imperial,
    //                     elevation_gain_metric,
    //                     elevation_loss_metric,
    //                     avg_grade_percent,
    //                     avg_grade_degree,
    //                     max_grade_percent,
    //                     max_grade_degree
    //                 )
    //             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    //         `, [
    //             trailId,
    //             stats.type,
    //             stats.distance.imperial,
    //             stats.distance.metric,
    //             stats.elevationHigh.imperial,
    //             stats.elevationHigh.metric,
    //             stats.elevationLow.imperial,
    //             stats.elevationLow.metric,
    //             stats.elevationGain.imperial,
    //             stats.elevationGain.metric,
    //             stats.elevationLoss.imperial,
    //             stats.elevationLoss.metric,
    //             stats.avgGrade.percent,
    //             stats.avgGrade.degree,
    //             stats.maxGrade.percent,
    //             stats.maxGrade.degree
    //         ])

    //         await db.query('COMMIT');

    //     } catch (e) {
    //         await db.query('ROLLBACK');
    //         console.error(e)
    //         throw new DatabaseError(`Error saving trail stats: ${e.message}`)
    //     } finally {
    //         db.release()
    //     }
    // }



    // /**
    //  * Updates stats for an existing trail, can handle updating any of the trail's stats.
    //  * 
    //  * @param {object} trailStats - stats that need to be updated.
    //  * @param {number} trailId - Id of the trail to update.
    //  * @returns {number} trailId
    //  * @throws {DatabaseError} If stats fail to save.
    //  */
    // static async updateTrailStats(trailStats, trailId) {

    //     const unpackedStats = {
    //         type: trailStats.type || null,
    //         distance_imperial: trailStats.distance.imperial || null,
    //         distance_metric: trailStats.distance.metric || null,
    //         elevation_high_imperial: trailStats.elevationHigh.imperial || null,
    //         elevation_high_metric: trailStats.elevationHigh.metric || null,
    //         elevation_low_imperial: trailStats.elevationLow.imperial || null,
    //         elevation_low_metric: trailStats.elevationLow.metric || null,
    //         elevation_gain_imperial: trailStats.elevationGain.imperial || null,
    //         elevation_gain_metric: trailStats.elevationGain.metric || null,
    //         elevation_loss_imperial: trailStats.elevationLoss.imperial || null,
    //         elevation_loss_metric: trailStats.elevationLoss.metric || null,
    //         avg_grade_percent: trailStats.avgGradePercent || null,
    //         avg_grade_degree: trailStats.avgGradeDegree || null,
    //         max_grade_percent: trailStats.maxGradePercent || null,
    //         max_grade_degree: trailStats.maxGradeDegree || null
    //     }

    //     for (const [key, value] of Object.entries(unpackedStats)) {
    //         if (value === null) {
    //             delete unpackedStats[key];
    //         }
    //     }

    //     const { setCols, values } = sqlForPartialUpdate(unpackedStats);
    //     const trailIdIdx = "$" + (values.length + 1)
    //     const db = await pool.connect();
    //     try {
    //         const statQuery = `
    //                 UPDATE trail_features
    //                 SET ${setCols}
    //                 WHERE trail_id = ${trailIdIdx}
    //                 RETURNING trail_id
    //             `;
    //         const result = await db.query(statQuery, [...values, trailId]);

    //         await db.query('COMMIT');
    //         return result.rows[0].trail_id;
    //     } catch (e) {
    //         await db.query('ROLLBACK')
    //         console.error(e)
    //         throw new DatabaseError(`Trail stats did not update: ${e.message}`)
    //     } finally {
    //         db.release();
    //     }
    // }

    // /**
    //  * Adds a feature to the trail_features table.
    //  * 
    //  * @param {string} feature 
    //  * @returns {object}  id, feature_name
    //  * @throws {BadRequestError} If feature already exists.
    //  * @throws {DatabaseError} If feature fails to save.
    //  */
    // static async addFeature(feature) {
    //     const db = await pool.connect();
    //     try {
    //         const featureQuery = await db.query(`
    //                 SELECT id FROM features
    //                 WHERE feature_name = $1
    //             `, [feature])

    //         const result = featureQuery.rows[0]

    //         if (result) {
    //             throw new BadRequestError(`Feature ${feature} already exists with id ${result.id}`)
    //         }

    //         const insertFeature = await db.query(`
    //                 INSERT INTO features
    //                 (feature_name)
    //                 VALUES ($1)
    //                 RETURNING id, feature_name
    //             `, [feature])

    //         const insertResult = insertFeature.rows[0]
    //         await db.query('COMMIT')

    //         return insertResult;
    //     } catch (e) {
    //         await db.query('ROLLBACK')
    //         console.error(e);
    //         if (e instanceof BadRequestError) {
    //             throw e;
    //         }
    //         throw new DatabaseError(`Error adding feature ${feature}: ${e.message}`)
    //     } finally {
    //         db.release();
    //     }
    // }

    // /**
    //  * Associates a feature to a trail, in the trail_features table.
    //  * 
    //  * @param {number} feature_id Id of feature to add to trail. 
    //  * @param {number} trail_id Id of trail for feature to be added.
    //  * @throws {BadRequestError} If feature is already associated with the trail.
    //  * @throws {DatabaseError} If association fails to save.
    //  */
    // static async addFeatureToTrail(feature_id, trail_id) {
    //     const db = await pool.connect();
    //     try {
    //         const featureQuery = await db.query(`
    //                 SELECT id FROM trail_features
    //                 WHERE feature_id = $1
    //                 AND trail_id =$2
    //             `, [feature_id, trail_id])

    //         const featureQueryResult = featureQuery.rows
    //         if (featureQueryResult.length > 0) {
    //             throw new BadRequestError(`Feature ${feature_id} is already associated with ${trail_id}.`)
    //         }
    //         const result = await db.query(`
    //                 INSERT INTO trail_features
    //                 (feature_id, trail_id)
    //                 VALUES ($1,$2)
    //             `, [feature_id, trail_id]);

    //         await db.query('COMMIT');
    //     } catch (e) {
    //         await db.query('ROLLBACK');
    //         console.error(e);
    //         if (e instanceof BadRequestError) {
    //             throw e;
    //         }
    //         throw new DatabaseError(`Feature not added to trail: ${e}`)
    //     } finally {
    //         db.release();
    //     }
    // }

    // /**
    //  * Removes feature association from a trail.
    //  * 
    //  * @param {number} featureId - Id of feature to be removed from trail.
    //  * @param {number} trailId - Id of trail to remove the feature from.
    //  * @throws {DatabaseError} If delete fails.
    //  */
    // static async removeFeatureFromTrail(featureId, trailId) {
    //     const db = await pool.connect();
    //     try {
    //         const result = await db.query(`
    //                 SELECT id FROM trail_features
    //                 WHERE feature_id = $1
    //                 AND trail_id = $2
    //             `, [featureId, trailId])

    //         const idsToRemove = result.rows.map(row => row.id);

    //         if (idsToRemove.length > 0) {
    //             const query = `
    //                     DELETE FROM trail_features
    //                     WHERE id = ANY($1::int[])
    //                 `;
    //             await db.query(query, [idsToRemove]);
    //         }

    //         await db.query('COMMIT');

    //     } catch (e) {
    //         await db.query('ROLLBACK');
    //         console.error(e);
    //         throw new DatabaseError(`Error removing feature ${featureId} from trail ${trailId}: ${e.message}`)
    //     } finally {
    //         db.release();
    //     }
    // }

    /**
//    * Updates the features for an existing trail.
//    * If feature is included in trailFeatures param and it is already associated with the trail it is removed.
//    * If feature is included in trailFeatures param and it is NOT associated with the trail it is added.
//    * @param {array} trailFeatures - Features to add or remove from being associated with trailId.
//    * @param {number} trailId - Id of the trail to update the features for.
//    * @throws {DatabaseError} If error updating trail features.
//    */
    //     static async updateTrailFeatures(trailFeatures, trailId) {
    //         try {
    //             if (trailFeatures.length > 0) {
    //                 const currentFeatures = await this.getTrailFeaturesById(trailId);

    //                 for (let feature of trailFeatures) {
    //                     const featureId = await this.getFeatureByName(feature);
    //                     if (currentFeatures.includes(feature)) {
    //                         await this.removeFeatureFromTrail(featureId, trailId);
    //                     } else {
    //                         await this.addFeatureToTrail(featureId, trailId);
    //                     }
    //                 }
    //             }
    //         } catch (e) {
    //             console.error('Error updating trail features:', e);
    //             throw new DatabaseError('Error updating trail features: ' + e.message);
    //         }
    //     }

}

module.exports = Trail;