// authRoutes.test.js
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const UserService = require("../models/UserService");
const { SECRET_KEY } = require("../config");
const passport = require("passport");

jest.mock("../models/User");
jest.mock("../models/UserService");

beforeAll(async () => {
    process.env.NODE_ENV = 'test';

});

describe("Auth Routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("POST /auth/login", () => {
        test("works: valid login", async () => {
            User.authenticate.mockResolvedValue({ username: "testuser", isAdmin: false });

            const response = await request(app)
                .post("/auth/login")
                .send({ username: "testuser", password: "password" });

            expect(response.statusCode).toBe(200);
            const { token } = response.body;
            expect(jwt.verify(token, SECRET_KEY)).toEqual(expect.objectContaining({ username: "testuser" }));
        });

        test("fails: invalid request body", async () => {
            const response = await request(app)
                .post("/auth/login")
                .send({ username: "testuser" }); // Missing password

            expect(response.statusCode).toBe(400);
        });

        test("fails: invalid credentials", async () => {
            User.authenticate.mockRejectedValue(new Error("Invalid username/password"));

            const response = await request(app)
                .post("/auth/login")
                .send({ username: "testuser", password: "wrongpassword" });

            expect(response.statusCode).toBe(500);
        });
    });

    describe("POST /auth/register", () => {
        test("works: valid registration", async () => {
            User.create.mockResolvedValue({ username: "newuser", isAdmin: false });

            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: "newuser",
                    password: "password",
                    firstName: "First",
                    lastName: "Last",
                    email: "newuser@example.com",
                    profileImagePath: "/images/newuser.jpg"
                });

            expect(response.statusCode).toBe(201);
            const { token } = response.body;
            expect(jwt.verify(token, SECRET_KEY)).toEqual(expect.objectContaining({ username: "newuser" }));
        });

        test("fails: invalid request body", async () => {
            const response = await request(app)
                .post("/auth/register")
                .send({ username: "newuser" }); // Missing required fields

            expect(response.statusCode).toBe(400);
        });

        test("fails: user creation error", async () => {
            User.create.mockRejectedValue(new Error("User creation error"));

            const response = await request(app)
                .post("/auth/register")
                .send({
                    username: "newuser",
                    password: "password",
                    firstName: "First",
                    lastName: "Last",
                    email: "newuser@example.com",
                    profileImagePath: "/images/newuser.jpg"
                });

            expect(response.statusCode).toBe(500);
        });
    });

});

