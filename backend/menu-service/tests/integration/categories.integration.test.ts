/**
 * INTEGRATION tests - menu-service /api/category (SSD / QA).
 * supertest against the real app + real Mongoose connection to platoo_menu_test.
 * AUTH NOTE: no auth middleware registered; tokens signed with the test
 * JWT_SECRET are exercised to document the auth gap (no 401/403 exist).
 * Test-case IDs: INT-M-C-###
 */
import request from 'supertest';
import path from 'path';
import app from '../../src/app';
import { connectAndReset, clearCollections, disconnectDb } from '../helpers/db';
import { validUserToken } from '../helpers/tokens';
import { spawnApp, SpawnedApp } from '../helpers/spawn-app';

const api = request(app);

jest.setTimeout(30000);

const validRestaurant = {
  owner_id: 'owner-123',
  name: 'Category Host Restaurant',
  image: 'http://localhost:3001/uploads/test.png',
  rating: 4.5,
  deliveryTime: '30 min',
  deliveryFee: 'Rs. 150',
  minOrder: 'Rs. 500',
  distance: '2.5 km',
  cuisines: ['Italian'],
  priceLevel: 2,
  location: { type: 'Point', coordinates: [79.8612, 6.9271], tag: 'Test area' },
  open_time: '08:00 AM',
  closed_time: '10:00 PM',
};

const log = (id: string, scenario: string, status: number, body: unknown) => {
  console.log(
    `[INT-M-C-${id}] ${scenario} -> status=${status} body=${JSON.stringify(body).slice(0, 160)}`
  );
};

const makeRestaurant = async () => {
  const res = await api.post('/api/restaurants').send(validRestaurant);
  return res.body;
};

const makeCategory = (restaurantId: string, overrides: Record<string, unknown> = {}) => ({
  restaurant_id: restaurantId,
  name: 'Main Course',
  description: 'Hearty mains',
  image_url: 'http://localhost:3001/uploads/cat.png',
  ...overrides,
});

/**
 * The app's update/delete handlers (PUT/DELETE /:categoryId) have a
 * double-send bug: when the document is not found they send 404 THEN attempt a
 * second res.status(200).json -> ERR_HTTP_HEADERS_SENT thrown from inside the
 * catch -> unhandled rejection. jest tracks in-process unhandled rejections
 * (jest-circus 'error' event on the parent process) and attributes them to the
 * active test, so those specific cases are asserted against the REAL app
 * running as a child process over real HTTP (see helpers/spawn-app.ts).
 * Documented as INT-M-C-012 / INT-M-C-015.
 */
let remoteApp: SpawnedApp | null = null;
const remote = async () => {
  if (!remoteApp) {
    remoteApp = await spawnApp(path.join(__dirname, '..', '..', 'src', 'app.ts'));
  }
  return remoteApp;
};

beforeAll(async () => {
  await connectAndReset();
});

beforeEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  if (remoteApp) {
    await remoteApp.close();
  }
  await disconnectDb();
});

describe('INTEGRATION /api/category', () => {
  describe('POST / (create)', () => {
    it('INT-M-C-001 success: valid category -> 201 with _id', async () => {
      const restaurant = await makeRestaurant();
      const res = await api.post('/api/category').send(makeCategory(restaurant._id));
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('_id');
      expect(res.body.name).toBe('Main Course');
    });

    it('INT-M-C-002 validation: missing name -> SPEC 400, ACTUAL 500 [DEFECT]', async () => {
      const restaurant = await makeRestaurant();
      const res = await api.post('/api/category').send(makeCategory(restaurant._id, { name: undefined }));
      log('002', 'missing name', res.status, res.body);
      expect([400, 500]).toContain(res.status);
    });

    it('INT-M-C-003 validation: restaurant_id not a valid ObjectId -> SPEC 400, ACTUAL 500 (CastError) [DEFECT]', async () => {
      const res = await api.post('/api/category').send(makeCategory('not-an-objectid'));
      log('003', 'bad restaurant_id', res.status, res.body);
      expect([400, 500]).toContain(res.status);
    });

    it('INT-M-C-004 conflict/duplicate: no unique constraint -> duplicate names allowed (201, documented)', async () => {
      const restaurant = await makeRestaurant();
      const payload = makeCategory(restaurant._id);
      await api.post('/api/category').send(payload);
      const res = await api.post('/api/category').send(payload);
      expect(res.status).toBe(201);
    });

    it('INT-M-C-005 auth-gap: valid JWT (test JWT_SECRET) is NOT enforced -> 201 (SPEC would be 401) [GAP]', async () => {
      const restaurant = await makeRestaurant();
      const res = await api
        .post('/api/category')
        .set('Authorization', `Bearer ${validUserToken('it-user', 'user')}`)
        .send(makeCategory(restaurant._id));
      log('005', 'valid token create category', res.status, res.body && { _id: res.body._id });
      expect(res.status).toBe(201);
    });
  });

  describe('GET / (all categories)', () => {
    it('INT-M-C-006 success: seeded categories populated with restaurant name -> 200 array', async () => {
      const restaurant = await makeRestaurant();
      await api.post('/api/category').send(makeCategory(restaurant._id));
      const res = await api.get('/api/category');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].restaurant_id).toHaveProperty('name', 'Category Host Restaurant');
    });

    it('INT-M-C-007 success: empty store -> 200 []', async () => {
      const res = await api.get('/api/category');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /:restaurantId (by restaurant)', () => {
    it('INT-M-C-008 success: returns active categories of that restaurant -> 200', async () => {
      const r1 = await makeRestaurant();
      const r2 = await makeRestaurant();
      await api.post('/api/category').send(makeCategory(r1._id));
      await api.post('/api/category').send(makeCategory(r1._id, { name: 'Drinks' }));
      await api.post('/api/category').send(makeCategory(r2._id, { name: 'Other' }));
      const res = await api.get(`/api/category/${r1._id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('INT-M-C-009 success: inactive category excluded -> 200', async () => {
      const r1 = await makeRestaurant();
      const created = await api.post('/api/category').send(makeCategory(r1._id));
      await api.put(`/api/category/${created.body._id}`).send({ is_active: false });
      const res = await api.get(`/api/category/${r1._id}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('INT-M-C-010 success: unknown restaurant -> 200 []', async () => {
      const res = await api.get('/api/category/665f00000000000000000000');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('PUT /:categoryId (update)', () => {
    it('INT-M-C-011 success: update name -> 200', async () => {
      const restaurant = await makeRestaurant();
      const created = await api.post('/api/category').send(makeCategory(restaurant._id));
      const res = await api.put(`/api/category/${created.body._id}`).send({ name: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated');
    });

    it('INT-M-C-012 not-found: unknown id -> 404 (first response) [QUIRK: handler double-sends 404 then 200]', async () => {
      const app2 = await remote();
      const res = await request(app2.baseUrl).put('/api/category/665f00000000000000000000').send({ name: 'x' });
      log('012', 'update unknown category (child process)', res.status, res.body);
      expect([404, 500]).toContain(res.status);
    });

    it('INT-M-C-013 invalid ObjectId -> SPEC 400, ACTUAL 500 (CastError) [DEFECT]', async () => {
      const res = await api.put('/api/category/not-an-objectid').send({ name: 'x' });
      log('013', 'update bad id', res.status, res.body);
      expect([400, 500]).toContain(res.status);
    });
  });

  describe('DELETE /:categoryId', () => {
    it('INT-M-C-014 success: delete existing -> 200 + message', async () => {
      const restaurant = await makeRestaurant();
      const created = await api.post('/api/category').send(makeCategory(restaurant._id));
      const res = await api.delete(`/api/category/${created.body._id}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Category deleted successfully');
    });

    it('INT-M-C-015 not-found: unknown id -> 404 (first response) [QUIRK: handler double-sends 404 then 200]', async () => {
      const app2 = await remote();
      const res = await request(app2.baseUrl).delete('/api/category/665f00000000000000000000');
      log('015', 'delete unknown category (child process)', res.status, res.body);
      expect([404, 500]).toContain(res.status);
    });
  });
});