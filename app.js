"use strict"

//Libraries:
const express = require("express");
const cors = require("cors"); // Cross Origin support
const morgan = require("morgan") //HTTP Logging
const passport = require('passport'); //Oauth
const multer = require('multer'); // File upload 
const path = require('path');
const fs = require('fs');

//Config
require('./passportSetup')
require('dotenv').config();

//Helpers & Middleware
const { NotFoundError } = require("./expressError");
const { authenticateJWT } = require("./middleware/auth");

//Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const trailRoutes = require("./routes/trails");

const app = express();



app.use(cors());
app.use(express.json());
app.use(morgan("tiny"))
app.use(authenticateJWT);


app.use(passport.initialize());

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/trails", trailRoutes);

/**
 * File upload management
 */

const uploadsFolder = process.env.UPLOADS_FOLDER;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsFolder);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage: storage });

app.post('/upload', upload.single('file'), (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).send("No file uploaded")
        };
        res.status(200).send({
            message: "File uploaded successfully",
            filePath: `${req.protocol}://${req.get('host')}/imageUploads/${file.filename}`,
        });
    } catch (e) {
        console.error('Error uploading file:', error);
        res.status(500).send('Error uploading file.');
    }
});

app.use('/imageUploads', express.static(uploadsFolder));

/** Handle 404 errors -- this matches everything */
app.use(function (req, res, next) {
    return next(new NotFoundError());
});

/** Generic error handler; anything unhandled goes here. */
app.use(function (err, req, res, next) {
    if (process.env.NODE_ENV !== "test") console.error(err.stack);
    const status = err.status || 500;
    const message = err.message;

    return res.status(status).json({
        error: { message, status },
    });
});



module.exports = app;