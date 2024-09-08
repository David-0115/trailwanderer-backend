// user.test.js
const db = require('../dbPool');
const User = require('./User');
const { DatabaseError, UnauthorizedError, NotFoundError } = require('../expressError');
const argon2 = require('argon2');

beforeAll(async () => {
    process.env.NODE_ENV = 'test';

});

afterAll(async () => {
    await db.query("DELETE FROM users");
    await db.end();
});

describe('User.create', () => {
    test('should create a new user', async () => {
        const newUser = {
            username: 'testuser',
            password: 'password123',
            firstName: 'Test',
            lastName: 'User',
            email: 'testuser@example.com',
            profileImagePath: '/images/testuser.jpg',
            acctType: 'local'
        };

        const user = await User.create(newUser);

        expect(user).toBeInstanceOf(User);
        expect(user.username).toBe(newUser.username);
        expect(user.firstName).toBe(newUser.firstName);
        expect(user.email).toBe(newUser.email);
        expect(user.acctType).toBe(newUser.acctType);
    });

    test('should hash the user password before saving', async () => {
        const newUser = {
            username: 'hashuser',
            password: 'securepassword',
            firstName: 'Hash',
            lastName: 'User',
            email: 'hashuser@example.com',
            profileImagePath: '/images/hashuser.jpg',
            acctType: 'local'
        };

        const user = await User.create(newUser);

        const savedUser = await User.findByUsername(newUser.username);

        expect(savedUser.passwordHash).not.toBe(newUser.password);
        expect(await argon2.verify(savedUser.passwordHash, newUser.password)).toBeTruthy();
    });
});


describe('User.authenticate', () => {
    test('should authenticate a user with correct credentials', async () => {
        const newUser = {
            username: 'authuser',
            password: 'authpassword',
            firstName: 'Auth',
            lastName: 'User',
            email: 'authuser@example.com',
            profileImagePath: '/images/authuser.jpg',
            acctType: 'local'
        };

        await User.create(newUser);

        const user = await User.authenticate(newUser.username, newUser.password);

        expect(user).toBeInstanceOf(User);
        expect(user.username).toBe(newUser.username);
    });

    test('should throw UnauthorizedError if username is not found', async () => {
        try {
            await User.authenticate('nonexistent', 'password');
        } catch (err) {
            expect(err instanceof UnauthorizedError).toBeTruthy();
            expect(err.message).toBe('Invalid username / password.');
        }
    });

    test('should throw UnauthorizedError if password is incorrect', async () => {
        const newUser = {
            username: 'wrongpassworduser',
            password: 'rightpassword',
            firstName: 'Wrong',
            lastName: 'Password',
            email: 'wrongpassworduser@example.com',
            profileImagePath: '/images/wrongpassworduser.jpg',
            acctType: 'local'
        };

        await User.create(newUser);

        try {
            await User.authenticate(newUser.username, 'wrongpassword');
        } catch (err) {
            expect(err instanceof UnauthorizedError).toBeTruthy();
            expect(err.message).toBe('Invalid username / password.');
        }
    });
});


describe('User.findByUsername', () => {
    test('should find a user by username', async () => {
        const newUser = {
            username: 'finduser',
            password: 'findpassword',
            firstName: 'Find',
            lastName: 'User',
            email: 'finduser@example.com',
            profileImagePath: '/images/finduser.jpg',
            acctType: 'local'
        };

        await User.create(newUser);

        const user = await User.findByUsername(newUser.username);

        expect(user).toBeInstanceOf(User);
        expect(user.username).toBe(newUser.username);
    });

    test('should return null if username does not exist', async () => {
        const user = await User.findByUsername('nonexistentuser');
        expect(user).toBeNull();
    });
});


describe('User.findById', () => {
    test('should find a user by ID', async () => {
        const newUser = {
            username: 'findbyiduser',
            password: 'findbyidpassword',
            firstName: 'FindById',
            lastName: 'User',
            email: 'findbyiduser@example.com',
            profileImagePath: '/images/findbyiduser.jpg',
            acctType: 'local'
        };

        const createdUser = await User.create(newUser);

        const user = await User.findById(createdUser.id);

        expect(user).toBeInstanceOf(User);
        expect(user.id).toBe(createdUser.id);
    });

    test('should return null if user ID does not exist', async () => {
        const user = await User.findById(9999); // Assuming this ID doesn't exist
        expect(user).toBeNull();
    });
});


describe('User.findByEmail', () => {
    test('should find a user by email', async () => {
        const newUser = {
            username: 'findbyemailuser',
            password: 'findbyemailpassword',
            firstName: 'FindByEmail',
            lastName: 'User',
            email: 'findbyemailuser@example.com',
            profileImagePath: '/images/findbyemailuser.jpg',
            acctType: 'local'
        };

        await User.create(newUser);

        const user = await User.findByEmail(newUser.email);

        expect(user).toBeInstanceOf(User);
        expect(user.email).toBe(newUser.email);
    });

    test('should return null if email does not exist', async () => {
        const user = await User.findByEmail('nonexistentemail@example.com');
        expect(user).toBeNull();
    });
});


describe('User.delete', () => {
    test('should delete a user by username', async () => {
        const newUser = {
            username: 'deleteuser',
            password: 'deletepassword',
            firstName: 'Delete',
            lastName: 'User',
            email: 'deleteuser@example.com',
            profileImagePath: '/images/deleteuser.jpg',
            acctType: 'local'
        };

        await User.create(newUser);

        const username = await User.delete(newUser.username);

        expect(username).toBe(newUser.username);

        const deletedUser = await User.findByUsername(newUser.username);
        expect(deletedUser).toBeNull();
    });

    test('should throw NotFoundError if username does not exist', async () => {
        try {
            await User.delete('nonexistentuser');
        } catch (err) {
            expect(err instanceof NotFoundError).toBeTruthy();
            expect(err.message).toBe('Username nonexistentuser not found.');
        }
    });
});



