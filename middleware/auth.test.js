
const jwt = require("jsonwebtoken");
const { UnauthorizedError } = require("../expressError");
const { SECRET_KEY } = require("../config");
const {
    authenticateJWT,
    ensureLoggedIn,
    ensureCurrUser,
} = require("./auth");

beforeAll(async () => {
    process.env.NODE_ENV = 'test';

});

describe("Middleware", () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {};
        res = {
            locals: {}
        };
        next = jest.fn();
    });

    describe("authenticateJWT", () => {
        test("works: valid token", () => {
            const token = jwt.sign({ username: "testuser", isAdmin: false }, SECRET_KEY);
            req.headers = { authorization: `Bearer ${token}` };

            authenticateJWT(req, res, next);

            expect(res.locals.user).toEqual(expect.objectContaining({
                username: "testuser",
                isAdmin: false
            }));
            expect(next).toHaveBeenCalled();
        });


        test("works: no header", () => {
            authenticateJWT(req, res, next);

            expect(res.locals.user).toBeUndefined();
            expect(next).toHaveBeenCalled();
        });

        test("works: invalid token", () => {
            req.headers = { authorization: `Bearer invalidtoken` };

            authenticateJWT(req, res, next);

            expect(res.locals.user).toBeUndefined();
            expect(next).toHaveBeenCalled();
        });
    });

    describe("ensureLoggedIn", () => {
        test("works: logged in", () => {
            res.locals.user = { username: "testuser", isAdmin: false };

            ensureLoggedIn(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test("unauth: not logged in", () => {
            ensureLoggedIn(req, res, next);

            expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
        });
    });

    describe("ensureCurrUser", () => {
        test("works: matching username", () => {
            res.locals.user = { username: "testuser" };
            req.params = { username: "testuser" };

            ensureCurrUser(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test("works: matching user ID", () => {
            res.locals.user = { id: 1 };
            req.params = { username: "1" };

            ensureCurrUser(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test("unauth: not matching", () => {
            res.locals.user = { username: "testuser" };
            req.params = { username: "wronguser" };

            ensureCurrUser(req, res, next);

            expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
        });

        test("unauth: not logged in", () => {
            req.params = { username: "testuser" };

            ensureCurrUser(req, res, next);

            expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
        });
    });
});

