const request = require("supertest");
const app = require("../app");
const db = require("../dbPool");
const { createToken } = require("../helpers/tokens")
const User = require("../models/User");
const Trail = require("../models/Trail");
const {
    UnauthorizedError,
    NotFoundError,
    BadRequestError
} = require("../expressError");


let testToken;

beforeAll(async () => {

    process.env.NODE_ENV = "test"
    const user = await User.create({
        username: "testuser",
        password: "password",
        firstName: "Test",
        lastName: "User",
        email: "testuser@example.com",
        profileImagePath: "/images/testuser.jpg",
        acctType: "local"
    });

    testToken = createToken(user)
    const trail = await Trail.getFullTrailsByIds([1]);


});


afterAll(async () => {
    await db.query('DELETE FROM users');
    await db.query('DELETE FROM wanted_trails');
    await db.query('DELETE FROM completed_trails');
    db.end();
});

/************ GET /:username */
describe("GET /:username", function () {
    test("works: valid user", async function () {
        const response = await request(app)
            .get("/users/testuser")
            .set("Authorization", `Bearer ${testToken}`);
        expect(response.statusCode).toBe(200);
        expect(response.body.user).toHaveProperty("username", "testuser");
    });

    test("unauth: not logged in", async function () {
        const response = await request(app).get("/users/testuser");
        expect(response.statusCode).toBe(401);
    });
});

/************ PATCH /:username */
describe("PATCH /:username", function () {
    test("works: valid update", async function () {
        const response = await request(app)
            .patch("/users/testuser")
            .set("Authorization", `Bearer ${testToken}`)
            .send({ firstName: "Updated" });
        expect(response.statusCode).toBe(200);
        expect(response.body.updatedUser.firstName).toBe("Updated");
    });

    test("bad request: invalid data", async function () {
        const response = await request(app)
            .patch("/users/testuser")
            .set("Authorization", `Bearer ${testToken}`)
            .send({ firstName: 12345 }); // Invalid data
        expect(response.statusCode).toBe(400);
    });

    test("unauth: not logged in", async function () {
        const response = await request(app)
            .patch("/users/testuser")
            .send({ firstName: "Updated" });
        expect(response.statusCode).toBe(401);
    });
});



/************ POST /:username/wishlist/:trailId */
describe("POST /:username/wishlist/:trailId", function () {
    test("works: valid add to wishlist", async function () {
        const response = await request(app)
            .post("/users/testuser/wishlist/1")
            .set("Authorization", `Bearer ${testToken}`);
        console.log(response.data)
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty("addedId");
    });

    test("unauth: not logged in", async function () {
        const response = await request(app).post("/users/testuser/wishlist/1");
        expect(response.statusCode).toBe(401);
    });
});

/************ GET /:username/wishlist */
describe("GET /:username/wishlist", function () {
    test("works: get wishlist", async function () {
        const response = await request(app)
            .get("/users/testuser/wishlist")
            .set("Authorization", `Bearer ${testToken}`);
        expect(response.statusCode).toBe(200);
        expect(response.body.wishlist).toBeInstanceOf(Array);
    });

    test("unauth: not logged in", async function () {
        const response = await request(app).get("/users/testuser/wishlist");
        expect(response.statusCode).toBe(401);
    });
});

/************ DELETE /:username/wishlist/:trailId */
describe("DELETE /:username/wishlist/:trailId", function () {
    test("works: valid remove from wishlist", async function () {
        const response = await request(app)
            .delete("/users/testuser/wishlist/1")
            .set("Authorization", `Bearer ${testToken}`);
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty("deletedId");
    });

    test("unauth: not logged in", async function () {
        const response = await request(app).delete("/users/testuser/wishlist/1");
        expect(response.statusCode).toBe(401);
    });
});


/************ POST /:username/completed/:trailId */
describe("POST /:username/completed/:trailId", function () {
    test("works: add to completed", async function () {
        const response = await request(app)
            .post("/users/testuser/completed/1")
            .set("Authorization", `Bearer ${testToken}`);
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty("addedId");
    });

    test("unauth: not logged in", async function () {
        const response = await request(app).post("/users/testuser/completed/1");
        expect(response.statusCode).toBe(401);
    });
});

/************ GET /:username/completed */
describe("GET /:username/completed", function () {
    test("works: get completed list", async function () {
        const response = await request(app)
            .get("/users/testuser/completed")
            .set("Authorization", `Bearer ${testToken}`);
        expect(response.statusCode).toBe(200);
        expect(response.body.completedList).toBeInstanceOf(Array);
    });

    test("unauth: not logged in", async function () {
        const response = await request(app).get("/users/testuser/completed");
        expect(response.statusCode).toBe(401);
    });
});

/************ GET /:username/stats */
describe("GET /:username/stats", function () {
    test("works: get user stats", async function () {
        const response = await request(app)
            .get("/users/testuser/stats")
            .set("Authorization", `Bearer ${testToken}`);
        expect(response.statusCode).toBe(200);
        expect(response.body.userStats).toHaveProperty("totalDistance");
        expect(response.body.userStats).toHaveProperty("highestElevation");
    });

    test("unauth: not logged in", async function () {
        const response = await request(app).get("/users/testuser/stats");
        expect(response.statusCode).toBe(401);
    });
});

/************ DELETE /:username/completed/:trailId */
describe("DELETE /:username/completed/:trailId", function () {
    test("works: remove from completed", async function () {
        const response = await request(app)
            .delete("/users/testuser/completed/1")
            .set("Authorization", `Bearer ${testToken}`);
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty("deletedId");
    });

    test("unauth: not logged in", async function () {
        const response = await request(app).delete("/users/testuser/completed/1");
        expect(response.statusCode).toBe(401);
    });
});


/************ DELETE /:username */
describe("DELETE /:username", function () {
    test("works: valid delete", async function () {
        const response = await request(app)
            .delete("/users/testuser")
            .set("Authorization", `Bearer ${testToken}`);
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({ deleted: "testuser" });
    });

    test("unauth: not logged in", async function () {
        const response = await request(app).delete("/users/testuser");
        expect(response.statusCode).toBe(401);
    });

    test("not found: invalid username", async function () {
        const response = await request(app)
            .delete("/users/nonexistentuser")
            .set("Authorization", `Bearer ${testToken}`);
        expect(response.statusCode).toBe(401);
    });
});



