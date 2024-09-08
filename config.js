"use strict";

/** Shared config for application; can be required many places. */

require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
require("colors");

const SECRET_KEY = process.env.SECRET_KEY || "secret-dev";

const PORT = +process.env.PORT || 3001;

// Use dev database, testing database, or via env var, production database
function getDatabaseName() {
    if (process.env.NODE_ENV === "test") {
        return process.env.DB_TEST_NAME || "tw_test";
    } else {
        return process.env.DB_NAME || "tw";
    }
}


console.log("Trail Wanderer Config:".green);
console.log("SECRET_KEY:".yellow, SECRET_KEY);
console.log("PORT:".yellow, PORT.toString());
console.log("Database:".yellow, getDatabaseName());
console.log("---");

module.exports = {
    SECRET_KEY,
    PORT,
    getDatabaseName,
};