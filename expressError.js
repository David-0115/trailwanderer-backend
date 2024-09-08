/** ExpressError extends normal JS error so we can
 *  add a status when we make an instance of it.
 *
 *  The error-handling middleware will return this.
 */

class ExpressError extends Error {
    constructor(message, status) {
        super();
        this.message = message;
        this.status = status;
    };
};

class NotFoundError extends ExpressError {
    constructor(message = "Not Found") {
        super(message, 404);
    };
};

class UnauthorizedError extends ExpressError {
    constructor(message = "Unauthorized") {
        super(message, 401);
    };
};

class BadRequestError extends ExpressError {
    constructor(message = "Bad Request") {
        super(message, 400);
    };
};

class ForbiddenError extends ExpressError {
    constructor(message = "Forbidden - Bad Request") {
        super(message, 403);
    };
};

class DatabaseError extends ExpressError {
    constructor(message = "Database error, transaction did not process. Please try again.") {
        super(message, 500)
    }
}

module.exports = {
    ExpressError,
    NotFoundError,
    UnauthorizedError,
    BadRequestError,
    ForbiddenError,
    DatabaseError
};