const db = require('../dbPool');
const UserService = require('./UserService');
const User = require('./User');
const OAuthProvider = require('./OAuthProvider');
const { DatabaseError } = require('../expressError');

jest.mock('./User');
jest.mock('./OAuthProvider');

beforeAll(async () => {
    process.env.NODE_ENV = 'test';
});

afterAll(async () => {
    await db.end();
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('UserService.findOrCreateOIDCUser', () => {
    test('should create a new user and OAuth provider if they do not exist', async () => {
        const oidcUserObj = {
            providerName: 'google',
            providerUserId: '12345',
            email: 'newuser@example.com',
            firstName: 'New',
            lastName: 'User',
            profileImagePath: '/images/newuser.jpg',
            accessToken: 'newAccessToken',
            refreshToken: 'newRefreshToken'
        };

        User.findByEmail.mockResolvedValue(null);
        User.create.mockResolvedValue({
            id: 1,
            ...oidcUserObj,
            acctType: 'oauth'
        });
        OAuthProvider.findByUserIdAndProvider.mockResolvedValue(null);
        OAuthProvider.create.mockResolvedValue({
            id: 1,
            userId: 1,
            providerName: oidcUserObj.providerName,
            providerUserId: oidcUserObj.providerUserId,
            accessToken: oidcUserObj.accessToken,
            refreshToken: oidcUserObj.refreshToken
        });

        const user = await UserService.findOrCreateOIDCUser(oidcUserObj);

        expect(User.findByEmail).toHaveBeenCalledWith(oidcUserObj.email);
        expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
            username: oidcUserObj.email.split('@')[0],
            firstName: oidcUserObj.firstName,
            lastName: oidcUserObj.lastName,
            email: oidcUserObj.email,
            profileImagePath: oidcUserObj.profileImagePath,
            acctType: 'oauth'
        }));
        expect(OAuthProvider.findByUserIdAndProvider).toHaveBeenCalledWith(1, oidcUserObj.providerName);
        expect(OAuthProvider.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 1,
            providerName: oidcUserObj.providerName,
            providerUserId: oidcUserObj.providerUserId,
            accessToken: oidcUserObj.accessToken,
            refreshToken: oidcUserObj.refreshToken
        }));

        expect(user).toEqual(expect.objectContaining({
            id: 1,
            email: oidcUserObj.email,
            firstName: oidcUserObj.firstName
        }));
    });

    test('should update OAuth provider if user exists but OAuth provider does not exist', async () => {
        const oidcUserObj = {
            providerName: 'google',
            providerUserId: '12345',
            email: 'existinguser@example.com',
            firstName: 'Existing',
            lastName: 'User',
            profileImagePath: '/images/existinguser.jpg',
            accessToken: 'newAccessToken',
            refreshToken: 'newRefreshToken'
        };

        User.findByEmail.mockResolvedValue({
            id: 2,
            ...oidcUserObj,
            acctType: 'oauth'
        });
        OAuthProvider.findByUserIdAndProvider.mockResolvedValue(null);
        OAuthProvider.create.mockResolvedValue({
            id: 2,
            userId: 2,
            providerName: oidcUserObj.providerName,
            providerUserId: oidcUserObj.providerUserId,
            accessToken: oidcUserObj.accessToken,
            refreshToken: oidcUserObj.refreshToken
        });

        const user = await UserService.findOrCreateOIDCUser(oidcUserObj);

        expect(User.findByEmail).toHaveBeenCalledWith(oidcUserObj.email);
        expect(OAuthProvider.findByUserIdAndProvider).toHaveBeenCalledWith(2, oidcUserObj.providerName);
        expect(OAuthProvider.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 2,
            providerName: oidcUserObj.providerName,
            providerUserId: oidcUserObj.providerUserId,
            accessToken: oidcUserObj.accessToken,
            refreshToken: oidcUserObj.refreshToken
        }));

        expect(user).toEqual(expect.objectContaining({
            id: 2,
            email: oidcUserObj.email,
            firstName: oidcUserObj.firstName
        }));
    });

    test('should update OAuth provider tokens if both user and OAuth provider exist', async () => {
        const oidcUserObj = {
            providerName: 'google',
            providerUserId: '12345',
            email: 'existinguser@example.com',
            firstName: 'Existing',
            lastName: 'User',
            profileImagePath: '/images/existinguser.jpg',
            accessToken: 'updatedAccessToken',
            refreshToken: 'updatedRefreshToken'
        };

        User.findByEmail.mockResolvedValue({
            id: 3,
            ...oidcUserObj,
            acctType: 'oauth'
        });
        OAuthProvider.findByUserIdAndProvider.mockResolvedValue({
            id: 3,
            userId: 3,
            providerName: oidcUserObj.providerName,
            providerUserId: oidcUserObj.providerUserId,
            accessToken: 'oldAccessToken',
            refreshToken: 'oldRefreshToken'
        });
        OAuthProvider.update.mockResolvedValue({
            id: 3,
            userId: 3,
            providerName: oidcUserObj.providerName,
            providerUserId: oidcUserObj.providerUserId,
            accessToken: oidcUserObj.accessToken,
            refreshToken: oidcUserObj.refreshToken
        });

        const user = await UserService.findOrCreateOIDCUser(oidcUserObj);

        expect(User.findByEmail).toHaveBeenCalledWith(oidcUserObj.email);
        expect(OAuthProvider.findByUserIdAndProvider).toHaveBeenCalledWith(3, oidcUserObj.providerName);
        expect(OAuthProvider.update).toHaveBeenCalledWith(expect.objectContaining({
            id: 3,
            accessToken: oidcUserObj.accessToken,
            refreshToken: oidcUserObj.refreshToken
        }));

        expect(user).toEqual(expect.objectContaining({
            id: 3,
            email: oidcUserObj.email,
            firstName: oidcUserObj.firstName
        }));
    });

    test('should throw DatabaseError if there is an error during user creation', async () => {
        const oidcUserObj = {
            providerName: 'google',
            providerUserId: '12345',
            email: 'erroruser@example.com',
            firstName: 'Error',
            lastName: 'User',
            profileImagePath: '/images/erroruser.jpg',
            accessToken: 'errorAccessToken',
            refreshToken: 'errorRefreshToken'
        };

        User.findByEmail.mockResolvedValue(null);
        User.create.mockRejectedValue(new DatabaseError('Error creating user'));

        try {
            await UserService.findOrCreateOIDCUser(oidcUserObj);
        } catch (err) {
            expect(err instanceof DatabaseError).toBeTruthy();
            expect(err.message).toContain('Error creating user');
        }

        expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
            username: oidcUserObj.email.split('@')[0],
            firstName: oidcUserObj.firstName,
            lastName: oidcUserObj.lastName,
            email: oidcUserObj.email,
            profileImagePath: oidcUserObj.profileImagePath,
            acctType: 'oauth'
        }));
    });
});

