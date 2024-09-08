const request = require("supertest");
const app = require("../app");
const Trail = require("../models/Trail");
const { searchTrails } = require("../models/TrailSearch");
const { searchTrailByName } = require("../helpers/maps");
const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("../config");

jest.mock("../models/Trail");
jest.mock("../models/TrailSearch");
jest.mock("../helpers/maps");


beforeAll(async () => {
    process.env.NODE_ENV = 'test';

});

afterEach(async () => {
    jest.clearAllMocks();
});

describe("GET /trails/search", () => {
    test("works: no filters", async () => {
        searchTrails.mockResolvedValue([{ id: 1, name: "Trail 1" }]);

        const response = await request(app).get("/trails/search")
            .query({ searchTerm: "Trail", page: 1, limit: 10 });

        expect(response.statusCode).toBe(200);
        expect(response.body.result).toEqual([{ id: 1, name: "Trail 1" }]);
    });

    test("works: with filters", async () => {
        const filters = { minDistanceImperial: 2, maxDistanceImperial: 10 };
        searchTrails.mockResolvedValue([{ id: 1, name: "Filtered Trail" }]);

        const response = await request(app).get("/trails/search")
            .query({ searchTerm: "Trail", page: 1, limit: 10, filters: JSON.stringify(filters) });

        expect(response.statusCode).toBe(200);
        expect(response.body.result).toEqual([{ id: 1, name: "Filtered Trail" }]);
    });
});

describe("GET /trails/search/:username", () => {
    let testToken;

    beforeAll(() => {
        const testUser = { id: 1, username: "testuser", isAdmin: false };
        testToken = jwt.sign(testUser, SECRET_KEY); // Generate a test token
    });

    test("works: valid user", async () => {
        const filters = { minDistanceImperial: 2, maxDistanceImperial: 10 };

        searchTrails.mockResolvedValue([{ id: 1, name: "User Filtered Trail" }]);

        const response = await request(app).get("/trails/search/testuser")
            .set("Authorization", `Bearer ${testToken}`) // Use the generated test token
            .query({ searchTerm: "Trail", page: 1, limit: 10, filters: JSON.stringify(filters) });

        expect(response.statusCode).toBe(200);
        expect(response.body.result).toEqual([{ id: 1, name: "User Filtered Trail" }]);
    });

    test("fails: unauthorized user", async () => {
        const response = await request(app).get("/trails/search/testuser");

        expect(response.statusCode).toBe(401);
    });
});

describe("GET /trails/:id/:username", () => {
    let testToken;

    beforeAll(() => {
        const testUser = { id: 1, username: "testuser", isAdmin: false };
        testToken = jwt.sign(testUser, SECRET_KEY); // Generate a test token
    });

    test("works: get trail by id and username", async () => {
        Trail.getFullTrailsByIds.mockResolvedValue([{ id: 1, name: "Trail 1" }]);

        const response = await request(app).get("/trails/1/testuser")
            .set("Authorization", `Bearer ${testToken}`); // Use the generated test token

        expect(response.statusCode).toBe(200);
        expect(response.body.trail).toEqual([{ id: 1, name: "Trail 1" }]);
    });

    test("fails: unauthorized access", async () => {
        const response = await request(app).get("/trails/1/testuser");

        expect(response.statusCode).toBe(401);
    });
});


describe("GET /trails/:id", () => {
    test("works: get trail by id", async () => {
        Trail.getFullTrailsByIds.mockResolvedValue([{ id: 1, name: "Trail 1" }]);

        const response = await request(app).get("/trails/1");

        expect(response.statusCode).toBe(200);
        expect(response.body.trail).toEqual([{ id: 1, name: "Trail 1" }]);
    });

    test("fails: trail not found", async () => {
        Trail.getFullTrailsByIds.mockRejectedValue(new Error("Trail not found"));

        const response = await request(app).get("/trails/999");

        expect(response.statusCode).toBe(500);
    });
});

describe("GET /trails/coords/:ids", () => {
    test("works: get trail coords by ids", async () => {
        Trail.getTrailCoordsByIds.mockResolvedValue([{ trail_id: 1, geojson: {} }]);

        const response = await request(app).get("/trails/coords/1");

        expect(response.statusCode).toBe(200);
        expect(response.body.coords).toEqual([{ trail_id: 1, geojson: {} }]);
    });

    test("fails: coords not found", async () => {
        Trail.getTrailCoordsByIds.mockRejectedValue(new Error("Coords not found"));

        const response = await request(app).get("/trails/coords/999");

        expect(response.statusCode).toBe(500);
    });
});


describe("POST /trails/map", () => {
    test("works: valid trail search", async () => {
        searchTrailByName.mockResolvedValue({ name: "Found Trail", state: "CA" });

        const response = await request(app).post("/trails/map")
            .send({ trailName: "Trail", state: "CA" });

        expect(response.statusCode).toBe(200);
        expect(response.body.resp).toEqual({ name: "Found Trail", state: "CA" });
    });

    test("fails: no trail found", async () => {
        searchTrailByName.mockRejectedValue(new Error("Trail not found"));

        const response = await request(app).post("/trails/map")
            .send({ trailName: "Nonexistent Trail", state: "CA" });

        expect(response.statusCode).toBe(500);
    });
});



