// trail.test.js
const db = require('../dbPool');
const Trail = require('./Trail');
const { NotFoundError, BadRequestError, DatabaseError } = require('../expressError');

beforeAll(async () => {
    process.env.NODE_ENV = 'test';

});

afterAll(async () => {
    await db.end();
});



describe('Trail.getFullTrailsByIds', () => {
    test('should return full trail details including stats and features', async () => {
        const trailIds = [1, 2];
        const trails = await Trail.getFullTrailsByIds(trailIds);
        expect(trails).toHaveLength(2);
        expect(trails[0]).toHaveProperty('id', 1);
        expect(trails[0]).toHaveProperty('name', 'Trail 1');
        expect(trails[0]).toHaveProperty('stats');
        expect(trails[0]).toHaveProperty('features');
        expect(trails[0].features).toContain('Cave');
    });

    test('should throw NotFoundError if trail IDs are not found', async () => {
        try {
            await Trail.getFullTrailsByIds([9999]);
        } catch (err) {
            expect(err instanceof NotFoundError).toBeTruthy();
        }
    });

    test('should throw BadRequestError if trail ID is not a number', async () => {
        try {
            await Trail.getFullTrailsByIds(['invalid']);
        } catch (err) {
            expect(err instanceof BadRequestError).toBeTruthy();
        }
    });
});


describe('Trail.verifyTrailExists', () => {
    test('should return true if trail exists', async () => {
        const trailId = 1;
        const exists = await Trail.verifyTrailExists(trailId);
        expect(exists).toBeTruthy();
    });

    test('should throw NotFoundError if trail does not exist', async () => {
        try {
            await Trail.verifyTrailExists(9999);
        } catch (err) {
            expect(err instanceof NotFoundError).toBeTruthy();
        }
    });
});


describe('Trail.getStatsByIds', () => {
    test('should retrieve trail stats in imperial units for valid trail IDs', async () => {
        const trailIds = [1, 2];
        const stats = await Trail.getStatsByIds(trailIds, 'imperial');

        expect(stats).toHaveLength(2);

        expect(stats[0]).toMatchObject({
            trail_id: 1,
            type: 'Loop',
            distance: 3.5,
            elevationHigh: 1200,
            elevationLow: 800,
            elevationGain: 400,
            avgGradePercent: 5,
            avgGradeDegree: 2.86,
            maxGradePercent: 10,
            maxGradeDegree: 5.71
        });

        expect(stats[1]).toMatchObject({
            trail_id: 2,
            type: 'Out & Back',
            distance: 4.2,
            elevationHigh: 1500,
            elevationLow: 1000,
            elevationGain: 500,
            avgGradePercent: 6,
            avgGradeDegree: 3.43,
            maxGradePercent: 12,
            maxGradeDegree: 6.86
        });
    });

    test('should retrieve trail stats in metric units for valid trail IDs', async () => {
        const trailIds = [1, 2];
        const stats = await Trail.getStatsByIds(trailIds, 'metric');

        expect(stats).toHaveLength(2);

        expect(stats[0]).toMatchObject({
            trail_id: 1,
            type: 'Loop',
            distance: 5.6,
            elevationHigh: 365.8,
            elevationLow: 243.8,
            elevationGain: 121.9,
            avgGradePercent: 5,
            avgGradeDegree: 2.86,
            maxGradePercent: 10,
            maxGradeDegree: 5.71
        });

        expect(stats[1]).toMatchObject({
            trail_id: 2,
            type: 'Out & Back',
            distance: 6.8,
            elevationHigh: 457.2,
            elevationLow: 304.8,
            elevationGain: 152.4,
            avgGradePercent: 6,
            avgGradeDegree: 3.43,
            maxGradePercent: 12,
            maxGradeDegree: 6.86
        });
    });

    test('should return an empty array if trail IDs do not exist', async () => {
        const trailIds = [9999, 8888];
        const stats = await Trail.getStatsByIds(trailIds);

        expect(stats).toHaveLength(0);
    });

    test('should return an empty array if no trail IDs are provided', async () => {
        const stats = await Trail.getStatsByIds([]);
        expect(stats).toHaveLength(0);
    });

    test('should throw DatabaseError if there is an error retrieving stats', async () => {
        // Simulate a database error by passing invalid SQL or other method to trigger error
        const originalQuery = db.query;
        db.query = jest.fn().mockImplementation(() => {
            throw new Error('Test database error');
        });

        try {
            await Trail.getStatsByIds([1, 2]);
        } catch (err) {
            expect(err instanceof DatabaseError).toBeTruthy();
        }

        // Restore original query function
        db.query = originalQuery;
    });
});

describe('Trail.getTrailFeaturesByIds', () => {
    test('should retrieve features for valid trail IDs', async () => {
        const trailIds = [1, 2];
        const features = await Trail.getTrailFeaturesByIds(trailIds);

        expect(features).toHaveLength(2);

        expect(features[0]).toMatchObject({
            trail_id: 1,
            features: expect.arrayContaining(['Cave', 'Waterfall', 'Wildflowers'])
        });

        expect(features[1]).toMatchObject({
            trail_id: 2,
            features: expect.arrayContaining(['Waterfall', 'Birding'])
        });
    });

    test('should retrieve features for a single valid trail ID', async () => {
        const trailIds = [3];
        const features = await Trail.getTrailFeaturesByIds(trailIds);

        expect(features).toHaveLength(1);

        expect(features[0]).toMatchObject({
            trail_id: 3,
            features: expect.arrayContaining(['Wildflowers', 'Fall Colors', 'River/Creek'])
        });
    });

    test('should return an empty array if trail IDs do not exist', async () => {
        const trailIds = [9999, 8888];
        const features = await Trail.getTrailFeaturesByIds(trailIds);

        expect(features).toHaveLength(0);
    });

    test('should return an empty array if no trail IDs are provided', async () => {
        const features = await Trail.getTrailFeaturesByIds([]);
        expect(features).toHaveLength(0);
    });

    test('should throw DatabaseError if there is an error retrieving features', async () => {
        // Simulate a database error by passing invalid SQL or other method to trigger error
        const originalQuery = db.query;
        db.query = jest.fn().mockImplementation(() => {
            throw new Error('Test database error');
        });

        try {
            await Trail.getTrailFeaturesByIds([1, 2]);
        } catch (err) {
            expect(err instanceof DatabaseError).toBeTruthy();
            expect(err.message).toContain('Error fetching trail features');
        }

        // Restore original query function
        db.query = originalQuery;
    });
});


describe('Trail.getStatsByIds', () => {
    test('should retrieve trail stats in imperial units for valid trail IDs', async () => {
        const trailIds = [1, 2];
        const stats = await Trail.getStatsByIds(trailIds, 'imperial');

        expect(stats).toHaveLength(2);

        expect(stats[0]).toMatchObject({
            trail_id: 1,
            type: 'Loop',
            distance: 3.5,
            elevationHigh: 1200,
            elevationLow: 800,
            elevationGain: 400,
            elevationLoss: 200,
            avgGradePercent: 5,
            avgGradeDegree: 2.86,
            maxGradePercent: 10,
            maxGradeDegree: 5.71
        });

        expect(stats[1]).toMatchObject({
            trail_id: 2,
            type: 'Out & Back',
            distance: 4.2,
            elevationHigh: 1500,
            elevationLow: 1000,
            elevationGain: 500,
            elevationLoss: 250,
            avgGradePercent: 6,
            avgGradeDegree: 3.43,
            maxGradePercent: 12,
            maxGradeDegree: 6.86
        });
    });

    test('should retrieve trail stats in metric units for valid trail IDs', async () => {
        const trailIds = [1, 2];
        const stats = await Trail.getStatsByIds(trailIds, 'metric');

        expect(stats).toHaveLength(2);

        expect(stats[0]).toMatchObject({
            trail_id: 1,
            type: 'Loop',
            distance: 5.6,
            elevationHigh: 365.8,
            elevationLow: 243.8,
            elevationGain: 121.9,
            elevationLoss: 60.9,
            avgGradePercent: 5,
            avgGradeDegree: 2.86,
            maxGradePercent: 10,
            maxGradeDegree: 5.71
        });

        expect(stats[1]).toMatchObject({
            trail_id: 2,
            type: 'Out & Back',
            distance: 6.8,
            elevationHigh: 457.2,
            elevationLow: 304.8,
            elevationGain: 152.4,
            elevationLoss: 76.2,
            avgGradePercent: 6,
            avgGradeDegree: 3.43,
            maxGradePercent: 12,
            maxGradeDegree: 6.86
        });
    });

    test('should return an empty array if trail IDs do not exist', async () => {
        const trailIds = [9999, 8888];
        const stats = await Trail.getStatsByIds(trailIds);

        expect(stats).toHaveLength(0);
    });

    test('should return an empty array if no trail IDs are provided', async () => {
        const stats = await Trail.getStatsByIds([]);
        expect(stats).toHaveLength(0);
    });

    test('should throw DatabaseError if there is an error retrieving stats', async () => {
        // Simulate a database error by passing invalid SQL or other method to trigger error
        const originalQuery = db.query;
        db.query = jest.fn().mockImplementation(() => {
            throw new Error('Test database error');
        });

        try {
            await Trail.getStatsByIds([1, 2]);
        } catch (err) {
            expect(err instanceof DatabaseError).toBeTruthy();
            expect(err.message).toContain('Error retrieving stats by ids');
        }

        // Restore original query function
        db.query = originalQuery;
    });
});

describe('Trail.getTrailFeaturesByIds', () => {
    test('should retrieve features for valid trail IDs', async () => {
        const trailIds = [1, 2];
        const features = await Trail.getTrailFeaturesByIds(trailIds);

        expect(features).toHaveLength(2);

        expect(features[0]).toMatchObject({
            trail_id: 1,
            features: expect.arrayContaining(['Cave', 'Waterfall', 'Wildflowers'])
        });

        expect(features[1]).toMatchObject({
            trail_id: 2,
            features: expect.arrayContaining(['Waterfall', 'Birding'])
        });
    });

    test('should retrieve features for a single valid trail ID', async () => {
        const trailIds = [3];
        const features = await Trail.getTrailFeaturesByIds(trailIds);

        expect(features).toHaveLength(1);

        expect(features[0]).toMatchObject({
            trail_id: 3,
            features: expect.arrayContaining(['Wildflowers', 'Fall Colors', 'River/Creek'])
        });
    });

    test('should return an empty array if trail IDs do not exist', async () => {
        const trailIds = [9999, 8888];
        const features = await Trail.getTrailFeaturesByIds(trailIds);

        expect(features).toHaveLength(0);
    });

    test('should return an empty array if no trail IDs are provided', async () => {
        const features = await Trail.getTrailFeaturesByIds([]);
        expect(features).toHaveLength(0);
    });

    test('should throw DatabaseError if there is an error retrieving features', async () => {
        // Simulate a database error by passing invalid SQL or other method to trigger error
        const originalQuery = db.query;
        db.query = jest.fn().mockImplementation(() => {
            throw new Error('Test database error');
        });

        try {
            await Trail.getTrailFeaturesByIds([1, 2]);
        } catch (err) {
            expect(err instanceof DatabaseError).toBeTruthy();
            expect(err.message).toContain('Error fetching trail features');
        }

        // Restore original query function
        db.query = originalQuery;
    });
});


describe('Trail.getFeatureByName', () => {
    test('should retrieve the feature ID for a valid feature name', async () => {
        const featureName = 'Waterfall';
        const featureId = await Trail.getFeatureByName(featureName);

        expect(featureId).toBeDefined();
        expect(featureId).toBe(2);  // Assuming 'Waterfall' has ID 2 in the test database
    });

    test('should throw NotFoundError if the feature name does not exist', async () => {
        const featureName = 'NonExistentFeature';

        try {
            await Trail.getFeatureByName(featureName);
        } catch (err) {
            expect(err instanceof NotFoundError).toBeTruthy();
            expect(err.message).toBe(`Feature ${featureName} not found.`);
        }
    });

    test('should throw DatabaseError if there is an error retrieving the feature ID', async () => {
        // Simulate a database error by passing invalid SQL or other method to trigger error
        const originalQuery = db.query;
        db.query = jest.fn().mockImplementation(() => {
            throw new Error('Test database error');
        });

        try {
            await Trail.getFeatureByName('Waterfall');
        } catch (err) {
            expect(err instanceof DatabaseError).toBeTruthy();
            expect(err.message).toContain('Error fetching feature by name');
        }

        // Restore original query function
        db.query = originalQuery;
    });
});



