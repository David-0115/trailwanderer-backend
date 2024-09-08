# Trail Wanderer

## Backend Documentation

### Table of Contents
- [Introduction](#introduction)
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Routes](#api-routes)
- [Testing](#testing)
- [Future Enhancements](#future-enhancements)


### Introduction
This backend project provides the core functionality for an outdoor adventure planning application. It manages users, trails, wishlists, completed trails, and more, providing a comprehensive API for interaction with the data.

### Features
- User Authentication and Authorization (including OAuth providers)
- Trail management including stats, features, and coordinates
- Wishlist management for users to save desired trails
- Completed trails tracking
- User stats calculation based on completed trails
- API Routes for searching and retrieving trail and user data

### Technologies Used
- **Node.js**: JavaScript runtime for building the backend.
- **Express**: Web framework for Node.js to build APIs.
- **PostgreSQL**: Relational database for storing all application data.
- **Argon2**: For secure password hashing.
- **JWT**: JSON Web Token for secure authentication.
- **Passport**: Middleware for authentication with different strategies (OAuth).
- **PostGIS**: Spatial database extender for PostgreSQL, used for handling trail coordinates.
- **wkx**: A utility for converting WKB (Well-Known Binary) data to GeoJSON.

### Setup Instructions

#### Prerequisites
- Node.js
- PostgreSQL with PostGIS extension

#### Installation
1. *Clone the repository*
2. *Install dependencies*
3. *Set up the database*
    * Create the PostgreSQL database
    * Enable the PostGIS extention (CREATE EXTENTION postgis;)
    * Run the SQL scripts provided in the sql / directory to set up the database schema and seed initial data.
4. *Set up environment variables*
    * Create a .env file in the root of your backend directory with the following variables:
        * DB_USER = database username
        * DB_PASS = database password
        * DB_HOST = host ip / hostname for database, (localhost = 127.0.0.1)
        * DB_PORT = database port (PostgreSQL default is 5432)
        * DB_NAME = name of primary database
        * DB_TEST_NAME = name of database used for tests. 
        * SECRET_KEY = your JWT secret key
        **If using Oauth** - These require account set up with Google / Facebook for Oauth. 
            * GOOGLE_CLIENT_ID
            * GOOGLE_CLIENT_SECRET
            * GOOGLE_CALLBACK_URL
            * FACEBOOK_CLIENT_ID
            * FACEBOOK_CLIENT_SECRET
            * FACEBOOK_CLIENT_TOKEN
            * FACEBOOK_CALLBACK_URL
            * FRONTEND_URL = URL for the front end application, used for oauth callback. 
5. *Run the server*

### Database Schema
The database consists of the following tables:

- **users**: Stores user details including authentication data.
- **oauth_providers**: Stores OAuth provider information linked to users.
- **trails**: Stores trail information.
- **trail_stats**: Stores statistics related to trails.
- **trail_features**: Links trails to various features.
- **completed_trails**: Tracks trails completed by users.
- **wanted_trails**: Tracks trails that users have added to their wishlist.
- **trail_images**: Stores paths to images associated with trails.
- **trail_polylines**: Stores trail polyline data as PostGIS geometry.

Refer to the `sql/schema.sql` file for the full schema definition.

## API Routes

### User Routes

- **GET /users/:username**: Get user details.
- **PATCH /users/:username**: Update user information.
- **DELETE /users/:username**: Delete a user.
- **POST /users/:username/wishlist/:trailId**: Add a trail to the user's wishlist.
- **DELETE /users/:username/wishlist/:trailId**: Remove a trail from the user's wishlist.
- **GET /users/:username/wishlist**: Get the user's wishlist.
- **POST /users/:username/completed/:trailId**: Add a trail to the user's completed trails.
- **DELETE /users/:username/completed/:trailId**: Remove a trail from the user's completed trails.
- **GET /users/:username/completed**: Get the user's completed trails.
- **GET /users/:username/stats**: Get the user's statistics.

### Trail Routes

- **GET /trails/search**: Search for trails.
- **GET /trails/search/:username**: Search for trails. Results include user specific completion and wishlist information.
- **GET /trails/:id**: Get full details of a specific trail.
- **GET /trails/coords/:ids**: Get coordinates for specific trails.

### Testing
* Tests are provided using Jest and Supertest. To run the tests: npm test
* The tests cover various aspects of the API, routes, models and middleware. 


### Future Enhancements
* User edit suggestions for trails.
* Ability for users to upload photos of trails.
* User ratings for trails.
* Gathering and including additional coordinates enabling a greater coverage of trails with maps.





