const pool = require('../dbPool');
const { DatabaseError, UnauthorizedError, NotFoundError } = require('../expressError');
const { createToken } = require('../helpers/tokens');
const argon2 = require("argon2");

const allUserData = `
    id,
    username,
    password_hash AS "passwordHash",
    first_name AS "firstName",
    last_name AS "lastName",
    email,
    profile_image_path AS "profileImagePath",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    active,
    acct_type AS "acctType"
`

class User {
    constructor({ id, username, passwordHash, firstName, lastName, email, profileImagePath, createdAt, updatedAt, active, acctType }) {
        this.id = id;
        this.username = username;
        this.passwordHash = passwordHash;
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.profileImagePath = profileImagePath;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.active = active;
        this.acctType = acctType;
    }


    /** authenticate(username, password)
     *  Authenticates an existing user local user. 
     * If authenticated, returns full user data.
     * If not authenticated or username not found throws new UnauthorizedError.
     * @param {string} username - The username of the user.
     * @param {string} password - The password of the user.
     * @returns {User}- User instance
     * @throws {UnauthorizedError} If username not found or password is not a match
     */
    static async authenticate(username, password) {
        const db = await pool.connect();
        try {

            const user = await this.findByUsername(username);

            if (user) {
                try {
                    const isMatch = await argon2.verify(user.passwordHash, password)
                    if (isMatch) {
                        delete user.passwordHash;
                        return user;
                    }
                } catch (e) {
                    console.error(e)
                }
            }
            throw new UnauthorizedError("Invalid username / password.")

        } catch (e) {
            if (e instanceof UnauthorizedError) {
                throw e
            } else {
                throw new DatabaseError(e.message);
            }

        } finally {
            db.release();
        }
    }
    /**
     * Find user by id, 
     * @param {number} id - user id. 
     * @returns {User} Instance of the user if found.
     * @returns {null} If user id not found
     * @throws {DatabaseError} If error with the database transaction.
     */
    static async findById(id) {
        const db = await pool.connect();
        try {
            const res = await db.query(`SELECT ${allUserData} FROM users WHERE id = $1`, [id]);
            return res.rows.length ? new User(res.rows[0]) : null;
        } catch (e) {
            throw new DatabaseError(e.message)
        } finally {
            db.release()
        }

    }

    /**
     * Find user by a user's email address.
     * @param {string} email - User's email address.  
     * @returns {User} Instance of the user if found.
     * @returns {null} If user' email is not found
     * @throws {DatabaseError} If error with the database transaction.
     */
    static async findByEmail(email) {
        const db = await pool.connect();
        try {
            const res = await db.query(`SELECT ${allUserData} FROM users WHERE email = $1`, [email])
            return res.rows.length ? new User(res.rows[0]) : null;
        } catch (e) {
            throw new DatabaseError(e.message)
        } finally {
            db.release()
        }
    }

    /**
     * Find user by their username.
     * @param {string} username - User's username 
     * @returns {User} Instance of the user if found.
     * @returns {null} If user's username not found
     * @throws {DatabaseError} If error with the database transaction.
     */
    static async findByUsername(username) {
        const db = await pool.connect();
        try {
            const res = await db.query(`SELECT ${allUserData} FROM users WHERE username = $1`, [username])
            return res.rows.length ? new User(res.rows[0]) : null;
        } catch (e) {
            throw new DatabaseError(e.message);
        } finally {
            db.release();
        }
    }

    /**
     * Create a user account, used by both local and oauth accounts.
     * @param {Object} user {username:(string), password:(string || null), firstName:(string), lastName:(string), email:(string), profileImagePath:(string), acctType:(string - local || oauth)} 
     * @returns {User} Instance of the created user.
     * @throws {DatabaseError} If database transaction error.
     */
    static async create(user) {
        const db = await pool.connect();
        try {
            const { username, password, firstName, lastName, email, profileImagePath, acctType } = user;
            let passwordHash = null;
            if (password) {
                passwordHash = await argon2.hash(password);
            }
            const res = await db.query(`
                    INSERT INTO users(
                        username,
                        password_hash,
                        first_name,
                        last_name,
                        email,
                        profile_image_path,
                        acct_type,
                        created_at
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)
                     RETURNING ${allUserData}
                `, [username, passwordHash, firstName, lastName, email, profileImagePath, acctType])

            const createdUser = new User(res.rows[0]);
            return createdUser;
        } catch (e) {
            throw new DatabaseError(e.message);
        } finally {
            db.release();
        }
    }

    static async handleUpdate(currUser, updatedData) {
        try {
            const user = await this.findByUsername(currUser);
            if (!user) {
                throw new NotFoundError(`${currUser} not found.`);
            }

            if (updatedData.password !== undefined) {
                user.passwordHash = await argon2.hash(updatedData.password);
            }
            const { username, firstName, lastName, email, profileImagePath } = updatedData;
            user.username = username || user.username
            user.firstName = firstName || user.firstName;
            user.lastName = lastName || user.lastName;
            user.email = email || user.email;
            user.profileImagePath = profileImagePath || user.profileImagePath;


            const updatedUser = await this.update(user);
            delete updatedUser.passwordHash;
            const token = createToken(user);
            updatedUser.token = token;

            return updatedUser;

        } catch (e) {
            console.error(e)
        }
    }
    /**
     * Update a user, when called the user parameter must contain
     * all of the user information, if not data will be set to null.
     * Usage: Get an existing user, update the datapoints needed, call this method.
     * If updating password - it should be hashed prior to calling this method.
     * @param {User} user - Instance of a user. 
     * @returns {User} - Instance of updated user **Includes hashed password**
     * @throws {DatabaseError} - If database transaction error.
     */
    static async update(user) {
        const { id, username, passwordHash, firstName, lastName, email, profileImagePath } = user;
        const db = await pool.connect();
        try {
            const res = await db.query(`
                    UPDATE users
                    SET username = $1,
                    password_hash = $2,
                    first_name = $3,
                    last_name = $4,
                    email = $5,
                    profile_image_path = $6,
                    updated_at = CURRENT_TIMESTAMP
                    WHERE id = $7
                    RETURNING ${allUserData}
                `, [username, passwordHash, firstName, lastName, email, profileImagePath, id]);

            return new User(res.rows[0])
        } catch (e) {
            throw new DatabaseError(e.message);
        } finally {
            db.release();
        }

    }

    /**
   * Retrieves trails a user has on their wish list. 
   * 
   * @param {number} userId -User id of the user to get wish list for.
   * @returns {array} - Array of trail_id's in user's wishlist or empty array if none.
   * @throws {DatabaseError} If there is an error retrieving the trail_ids from the database.
   */
    static async getWishList(userId) {
        const db = await pool.connect()
        const Trail = require('./Trail')
        try {
            const result = await db.query(`
                    SELECT trail_id FROM wanted_trails WHERE user_id = $1
                `, [userId])

            // const userTrails = result.rows  //array of objects
            // const trailIds = userTrails.map((obj) => (obj.trail_id))
            // const completedTrails = await Trail.getFullTrailsByIds(trailIds, userId)
            const wishlistTrails = result.rows;
            const trailIds = wishlistTrails.map((obj) => (obj.trail_id));
            const wishList = await Trail.getFullTrailsByIds(trailIds, userId);

            return wishList
        } catch (e) {
            console.error(e);
            throw new DatabaseError(`Unable to retrive wishlist for user ${userId}: ${e.message}`)
        } finally {
            db.release();
        }

    }

    static async isOnWishList(userId, trailIds) {
        const db = await pool.connect();
        try {
            const result = await db.query(`
                    SELECT trail_id
                    FROM wanted_trails WHERE user_id = $1
                    AND trail_id = ANY($2::int[])
                `, [userId, trailIds])

            const wishList = result.rows.map((row) => (row.trail_id));
            return wishList;

        } catch (e) {
            console.error(e);
            throw new DatabaseError(`Unable to retrive wishlist for user ${userId}`)
        } finally {
            db.release()
        }
    }

    /**
    * Adds a trail to a user's wish list. 
    * 
    * @param {number} userId User's wishlist to add the trail to.
    * @param {number} trailId Trail to add to the wishlist.
    * @throws {DatabaseError} If trail_id not added to user_id's wishlist.
    */
    static async addToWishList(userId, trailId) {
        const db = await pool.connect();
        try {
            const result = await db.query(`
                        INSERT INTO wanted_trails
                        (user_id, trail_id)
                        VALUES ($1,$2)
                        RETURNING trail_id
                    `, [userId, trailId])

            const id = result.rows[0].trail_id

            return id

        } catch (e) {
            console.error(e);
            if (e instanceof NotFoundError) {
                throw e;
            }
            throw new DatabaseError(`Trail ${trailId} not added to wish list for ${userId}: ${e.message}`)
        } finally {
            db.release();
        }
    }

    /**
 * Removes a trail from a users wish list.
 * 
 * @param {number} userId 
 * @param {number} trailId 
 * @throws {NotFoundError} if userId & trailId not found in wanted_trails table.
 * @throws {DatabaseError} if error processing database transaction.
 */
    static async deleteFromWishList(userId, trailId) {
        const db = await pool.connect();
        try {

            const result = await db.query(`
                        DELETE FROM wanted_trails
                        WHERE user_id = $1
                        AND trail_id = $2
                        RETURNING trail_id
                    `, [userId, trailId])

            const deletedId = result.rows[0].trail_id
            if (!deletedId) throw new NotFoundError(`Trail not found on users wish list.`)

            return deletedId

        } catch (e) {
            console.error(e);
            if (e instanceof NotFoundError) {
                throw e;
            }
            throw new DatabaseError(`Trail ${trailId} not added removed from wish list for ${userId}: ${e.message}`)
        } finally {
            db.release()
        }
    }

    /**
    * Retrieves trails that the user has completed adds user specific completion
    * data to the full trail object and returns the full trail.
    * 
    * @param {number} userId - User id of the searched user.
    * @returns {Promise<Array><Object>} - A promise that resolves to an array of trail object contianing the trail data or an empty array if no completed trails.
    * @throws {DatabaseError} - If there is an error retrieving the completed trails from the database.
    */
    static async getCompleted(userId) {
        const Trail = require('./Trail')
        const db = await pool.connect();
        try {
            const result = await db.query(`
                SELECT 
                    trail_id
                FROM completed_trails
                WHERE user_id = $1
            `, [userId])

            const userTrails = result.rows  //array of objects
            const trailIds = userTrails.map((obj) => (obj.trail_id))
            const completedTrails = await Trail.getFullTrailsByIds(trailIds, userId)

            return completedTrails
        } catch (e) {
            console.error(e)
            throw new DatabaseError(`Error retrieving completed trails for user ${userId}: ${e.message}`);
        } finally {
            db.release();
        }

    }

    static async isOnCompletedList(userId, trailIds) {
        const db = await pool.connect();
        try {

            const result = await db.query(`
                    SELECT trail_id
                    FROM completed_trails WHERE user_id = $1
                    AND trail_id = ANY($2::int[])
                `, [userId, trailIds])

            const completed = result.rows.map((row) => (row.trail_id))
            return completed;

        } catch (e) {
            console.error(e);
            throw new DatabaseError(`Unable to retrive wishlist for user ${userId}`)
        } finally {
            db.release()
        }
    }



    //initial implementation does not utilize date_completed
    static async addCompleted(userId, trailId) {
        const db = await pool.connect();

        try {

            const result = await db.query(`
                    INSERT into completed_trails
                    (user_id, trail_id)
                    VALUES ($1,$2)
                    RETURNING id
                `, [userId, trailId]);

            return result.rows[0].id
        } catch (e) {
            console.error(e);
            if (e instanceof NotFoundError) {
                throw e;
            } else {
                throw new DatabaseError(`Error removing trail from completed list ${e.message}`)
            }

        } finally {
            db.release();
        }
    }

    static async deleteCompleted(userId, trailId) {
        const db = await pool.connect();
        try {

            const result = await db.query(`
                    DELETE from completed_trails
                    WHERE user_id = $1
                    AND trail_id = $2
                    RETURNING id
                `, [userId, trailId])

            const deletedId = result.rows[0].id

            return deletedId;
        } catch (e) {
            console.error(e);
            if (e instanceof NotFoundError) {
                throw e;
            } else {
                throw new DatabaseError(`Error removing trail from completed list ${e.message}`)
            }

        } finally {
            db.release();
        }
    }

    static async getUserStats(userId, unit = 'imperial') {
        const db = await pool.connect();
        try {

            const result = await db.query(`
                    SELECT SUM(distance_${unit}) AS "totalDistance",
                    MAX(elevation_high_${unit}) AS "highestElevation",
                    SUM(elevation_gain_${unit}) AS "totalElevationGain",
                    COUNT(ct.trail_id) AS "trailsCompleted"
                    FROM trail_stats ts
                    JOIN completed_trails ct
                    ON ts.trail_id = ct.trail_id
                    WHERE ct.user_id = $1
                `, [userId])

            return result.rows[0]
        } catch (e) {
            throw new DatabaseError('Error fetching user stats:', e);
        } finally {
            db.release();
        }
    }
    /**
   * Deletes a user from the database
   * @param {String} username 
   * @returns {Object} The deleted user's data
   * @returns {string} return.username - The deleted username.
   */
    static async delete(username) {
        const db = await pool.connect();
        try {
            const user = await this.findByUsername(username);

            if (!user) throw new NotFoundError(`Username ${username} not found.`);

            const result = await db.query(
                `DELETE
                    FROM users
                    WHERE username = $1
                    RETURNING username`,
                [username]
            );

            return result.rows[0].username;

        } catch (e) {
            console.error(e);
            if (e instanceof NotFoundError) {
                throw e;
            }
            throw new DatabaseError();
        } finally {
            db.release();
        }
    }
}


module.exports = User;