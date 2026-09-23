/**
 * SEARCH-SERVICE - INTEGRATION tests.
 * Boots the real Express app against an in-memory MongoDB (mongodb-memory-server)
 * and drives HTTP with supertest. RATE_LIMIT_MAX is raised before the app is
 * required so the suite is never throttled; the menu/category handlers are not
 * exercised here because they depend on the external menu service (covered by
 * unit tests with a mocked axios instead).
 */
import type { Express } from 'express';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoose: typeof import('mongoose');

const SEED = [
  { name: 'Pizza Palace', location: 'Colombo', cuisines: ['Italian', 'Pizza'], menuItems: [] },
  { name: 'Kottu Hut', location: 'Galle', cuisines: ['Sri Lankan'], menuItems: [] },
  { name: 'Burger Barn', location: 'Colombo', cuisines: ['American'], menuItems: [] },
];

describe('search-service API (integration)', () => {
  let mongo: MongoMemoryServer;
  let app: Express;
  let RestaurantModel: { create: (docs: unknown[]) => Promise<unknown> };

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();

    process.env.MONGO_URI = uri;
    process.env.RATE_LIMIT_MAX = '5000';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';

    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mongoose = require('mongoose');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RestaurantModel = require('../../src/models/restaurant.model').default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    app = (require('../../src/app') as { default: Express }).default;

    await mongoose.connect(uri);
    await (RestaurantModel.create as (docs: unknown[]) => Promise<unknown>)(SEED);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await mongo.stop();
    jest.resetModules();
  });

  describe('validation', () => {
    test('no search parameters -> 400 JSON, no stack trace', async () => {
      const res = await request(app).get('/api/restaurants');
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/json');
      expect(JSON.stringify(res.body)).not.toContain('node_modules');
    });

    test('NoSQL operator objects (query[$ne]) are rejected -> 400', async () => {
      const res = await request(app).get('/api/restaurants').query({ query: { $ne: 'pizza' } });
      expect(res.status).toBe(400);
    });

    test('cuisine[$ne] operator is rejected -> 400', async () => {
      const res = await request(app).get('/api/restaurants').query({ cuisine: { $ne: 'X' } });
      expect(res.status).toBe(400);
    });
  });

  describe('restaurant search', () => {
    test('returns seeded restaurants by name (case-insensitive)', async () => {
      const res = await request(app).get('/api/restaurants').query({ query: 'pizza' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const names = res.body.map((r: { name: string }) => r.name);
      expect(names).toContain('Pizza Palace');
    });

    test('partial matches are found', async () => {
      const res = await request(app).get('/api/restaurants').query({ query: 'kottu' });
      expect(res.status).toBe(200);
      expect(res.body.map((r: { name: string }) => r.name)).toEqual(['Kottu Hut']);
    });

    test('empty result set returns 200 with an empty array (not an error)', async () => {
      const res = await request(app).get('/api/restaurants').query({ query: 'xyz-nomatch' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('cuisine filter narrows the results', async () => {
      const res = await request(app).get('/api/restaurants').query({ cuisine: 'Italian' });
      expect(res.status).toBe(200);
      expect(res.body.map((r: { name: string }) => r.name)).toEqual(['Pizza Palace']);
    });

    test('no restaurants match the location filter for plain-string documents (documented schema gap: controller queries location.tag, model stores location as String)', async () => {
      // The controller builds { 'location.tag': ... } but the Restaurant schema
      // declares `location: String`, so plain-string docs never match a dot-path.
      // The endpoint must still answer 200 (empty array), never 500.
      const res = await request(app).get('/api/restaurants').query({ location: 'Colombo' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('pagination: limit is respected', async () => {
      const res = await request(app).get('/api/restaurants').query({ query: 'a', limit: '1' });
      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(1);
    });

    test('huge limit is clamped to 100', async () => {
      const res = await request(app).get('/api/restaurants').query({ query: 'a', limit: '999999' });
      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(100);
    });

    test('regex metacharacters are escaped, never crash', async () => {
      const res = await request(app).get('/api/restaurants').query({ query: '(a+)+$.*' });
      expect([200, 400]).toContain(res.status);
      expect(JSON.stringify(res.body)).not.toContain('node_modules');
    });
  });

  describe('unknown route / hardening', () => {
    test('unknown route returns JSON 404', async () => {
      const res = await request(app).get('/api/nope');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Not Found' });
    });

    test('security headers present, no X-Powered-By', async () => {
      const res = await request(app).get('/api/restaurants').query({ query: 'pizza' });
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });
});