"use strict";
/** Database setup for Trail Wanderer. */
const { Pool } = require("pg");
// const { getDatabaseUri } = require("./config");
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });

const dbName = process.env.NODE_ENV === "test"
    ? process.env.DB_TEST_NAME
    : process.env.DB_NAME;

const dbClientData = process.env.DB_URL
    ? { connectionString: process.env.DB_URL }
    : {
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        host: process.env.DB_HOST || "localhost",
        port: process.env.DB_PORT || 5432,
        database: dbName
    }

const pool = new Pool(dbClientData)


module.exports = pool;
