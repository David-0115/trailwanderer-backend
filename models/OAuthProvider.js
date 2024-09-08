const pool = require('../dbPool');
const { DatabaseError } = require('../expressError');


const allOauthData = `
    id,
    user_id AS "userId",
    provider_name AS "providerName",
    provider_user_id AS "providerUserId",
    access_token AS "accessToken",
    refresh_token AS "refreshToken",
    token_expiry AS "tokenExpiry",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
`

class OAuthProvider {
    constructor({ id, userId, providerName, providerUserId, accessToken, refreshToken, tokenExpiry, createdAt, updatedAt }) {
        this.id = id;
        this.userId = userId;
        this.providerName = providerName;
        this.providerUserId = providerUserId;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.tokenExpiry = tokenExpiry;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    static async findByUserIdAndProvider(userId, providerName) {
        const db = await pool.connect();
        try {
            const res = await db.query(`SELECT ${allOauthData} FROM oauth_providers WHERE user_id = $1 AND provider_name = $2`, [userId, providerName])
            return res.rows.length ? new OAuthProvider(res.rows[0]) : null;
        } catch (e) {
            throw new DatabaseError(e.message);
        } finally {
            db.release();
        }
    }

    static async create(oauthProvider) {
        const db = await pool.connect();
        try {
            const { userId, providerName, providerUserId, accessToken, refreshToken, tokenExpiry } = oauthProvider;

            const expiry = tokenExpiry || null

            const res = await db.query(`
                    INSERT INTO oauth_providers
                    (
                        user_id,
                        provider_name,
                        provider_user_id,
                        access_token,
                        refresh_token,
                        token_expiry,
                        created_at
                    )
                    VALUES($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)
                    RETURNING ${allOauthData}
                `, [userId, providerName, providerUserId, accessToken, refreshToken, expiry]);

            return new OAuthProvider(res.rows[0]);
        } catch (e) {
            throw new DatabaseError(e.message);
        } finally {
            db.release()
        }
    }

    static async update(oauthProvider) {
        const db = await pool.connect();
        try {
            const { userId, providerName, providerUserId, accessToken, refreshToken, tokenExpiry } = oauthProvider;

            const expiry = tokenExpiry || null
            const res = await db.query(`
                    UPDATE oauth_providers
                    SET provider_name = $1,
                    provider_user_id = $2,
                    access_token = $3,
                    refresh_token = $4,
                    token_expiry = $5,
                    updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = $6
                    RETURNING ${allOauthData}
                `, [providerName, providerUserId, accessToken, refreshToken, expiry, userId]);

            return new OAuthProvider(res.rows[0]);

        } catch (e) {
            throw new DatabaseError(e.message);
        } finally {
            db.release()
        }
    }
}

module.exports = OAuthProvider;