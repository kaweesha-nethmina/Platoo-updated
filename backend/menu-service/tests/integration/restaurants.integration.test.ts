/**
 * INTEGRATION tests - menu-service /api/restaurants (SSD / QA).
 * Uses supertest against the REAL express app (import { app }, no running server)
 * with a REAL Mongoose connection to the dedicated TEST database platoo_menu_test.
 * The DB is dropped in beforeAll and cleared in beforeEach; disconnected in afterAll.
 *
 * AUTH NOTE: menu-service registered NO auth middleware (src/app.ts has none).
 * 401/403 do not exist in this app. We still exercise a token signed locally with
 * the test JWT_SECRET (user-service payload shape {id, role}, expiresIn 1d) and
 * assert/document the ACTUAL behaviour (requests succeed regardless of auth).
 *
 * Test-case IDs: INT-M-R-###
 */
import request from 'supertest';
import app from '../../src/app';
import { connectAndReset, clearCollections, disconnectDb } from '../helpers/db';
import { validUserToken, expiredToken, tamperedToken } from '../helpers/tokens';

const api = request(app);

const validRestaurant = {
  owner_id: 'owner-123',
  name: 'Test Restaurant',
  image: 'http://localhost:3001/uploads/test.png',
  rating: 4.5,
  deliveryTime: '30 min',
  deliveryFee: 'Rs. 150',
  minOrder: 'Rs. 500',
  distance: '2.5 km',
  cuisines: ['Italian', 'Pizza'],
  priceLevel: 2,
  location: { type: 'Point', coordinates: [79.8612, 6.9271], tag: 'Test area' },
  open_time: '08:00 AM',
  closed_time: '10:00 PM',
};

const log = (id: string, scenario: string, status: number, body: unknown) => {
  console.log(
    `[INT-M-R-${id}] ${scenario} -> status=${status} body=${JSON.stringify(body).slice(0, 160)}`
  );
};

const createOne = async (body: Record<string, unknown> = validRestaurant) => {
  const res = await api.post('/api/restaurants').send(body);
  return res;
};

beforeAll(async () => {
  await connectAndReset();
});

beforeEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await disconnectDb();
});

describe('INTEGRATION /api/restaurants', () => {
  describe('POST / (create)', () => {
    it('INT-M-R-001 success: valid restaurant -> 201 with _id (SPEC: 201)', async () => {
      const res = await createOne();
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('_id');
      expect(res.body.name).toBe('Test Restaurant');
      expect(res.body.is_active).toBe(true);
    });

    it('INT-M-R-002 validation: empty body -> SPEC 400, ACTUAL 500 (no validation layer) [DEFECT]', async () => {
      const res = await createOne({});
      log('002', 'empty body', res.status, res.body);
      expect([400, 500]).toContain(res.status); // documents ValidationError -> 500
    });

    it('INT-M-R-003 validation: missing required name -> SPEC 400, ACTUAL 500 [DEFECT]', async () => {
      const { name, ...payload } = validRestaurant;
      const res = await createOne(payload as any);
      log('003', 'missing name', res.status, res.body);
      expect([400, 500]).toContain(res.status);
    });

    it('INT-M-R-004 validation: wrong-typed name (number) -> SPEC 400, ACTUAL 201 (mongoose silently casts 123 -> "123"; no strict typing) [DEFECT]', async () => {
      const res = await createOne({ ...validRestaurant, name: 123 });
      log('004', 'numeric name', res.status, res.body && { name: res.body.name });
      expect([400, 500, 201]).toContain(res.status);
    });

    it('INT-M-R-005 conflict/duplicate: no unique constraint, duplicate name allowed -> 201 (documented)', async () => {
      await createOne({ ...validRestaurant, name: 'Dup Name' });
      const res = await createOne({ ...validRestaurant, name: 'Dup Name' });
      expect(res.status).toBe(201);
    });

    it('INT-M-R-006 auth-gap: request WITHOUT Authorization header succeeds -> 201 (SPEC would be 401) [GAP]', async () => {
      const res = await api.post('/api/restaurants').send(validRestaurant);
      log('006', 'no auth header', res.status, res.body && { _id: res.body._id });
      expect(res.status).toBe(201);
    });

    it('INT-M-R-007 auth-gap: VALID token (signed w/ test JWT_SECRET, user-service shape) -> 201, token ignored (SPEC would be 401) [GAP]', async () => {
      const token = validUserToken('it-user-1', 'user');
      const res = await api
        .post('/api/restaurants')
        .set('Authorization', `Bearer ${token}`)
        .send(validRestaurant);
      log('007', 'valid token', res.status, res.body && { _id: res.body._id });
      expect(res.status).toBe(201);
    });

    it('INT-M-R-008 auth-gap: EXPIRED token -> 201 (SPEC would be 401) [GAP]', async () => {
      const res = await api
        .post('/api/restaurants')
        .set('Authorization', `Bearer ${expiredToken()}`)
        .send(validRestaurant);
      log('008', 'expired token', res.status, res.body && { _id: res.body._id });
      expect(res.status).toBe(201);
    });

    it('INT-M-R-009 auth-gap: TAMPERED token -> 201 (SPEC would be 401) [GAP]', async () => {
      const res = await api
        .post('/api/restaurants')
        .set('Authorization', `Bearer ${tamperedToken()}`)
        .send(validRestaurant);
      log('009', 'tampered token', res.status, res.body && { _id: res.body._id });
      expect(res.status).toBe(201);
    });
  });

  describe('GET / (list)', () => {
    it('INT-M-R-010 success: seeded restaurants listed -> 200 array (SPEC: 200)', async () => {
      await createOne();
      await createOne({ ...validRestaurant, name: 'Second' });
      const res = await api.get('/api/restaurants');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });

    it('INT-M-R-011 success: empty store -> 200 []', async () => {
      const res = await api.get('/api/restaurants');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('INT-M-R-012 filtering: is_active=false excluded from list (PUT mass-assign), active included', async () => {
      const r1 = await createOne();
      await createOne({ ...validRestaurant, name: 'Active 2' });
      await api.put(`/api/restaurants/${r1.body._id}`).send({ is_active: false });
      const res = await api.get('/api/restaurants');
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Active 2');
    });
  });

  describe('GET /:restaurantId (single)', () => {
    it('INT-M-R-013 success: valid id -> 200 with document', async () => {
      const created = await createOne();
      const res = await api.get(`/api/restaurants/${created.body._id}`);
      expect(res.status).toBe(200);
      expect(res.body._id).toBe(created.body._id);
    });

    it('INT-M-R-014 not-found: valid-but-unknown ObjectId -> 404 (SPEC: 404)', async () => {
      const res = await api.get('/api/restaurants/665f00000000000000000000');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Restaurant not found');
    });

    it('INT-M-R-015 validation: malformed ObjectId -> SPEC 400, ACTUAL 500 (CastError) [DEFECT]', async () => {
      const res = await api.get('/api/restaurants/not-an-objectid');
      log('015', 'malformed id', res.status, res.body);
      expect([400, 500]).toContain(res.status);
    });
  });

  describe('PUT /:restaurantId (update)', () => {
    it('INT-M-R-016 success: update name/rating -> 200 with updated doc', async () => {
      const created = await createOne();
      const res = await api.put(`/api/restaurants/${created.body._id}`).send({ name: 'Renamed', rating: 1 });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renamed');
      expect(res.body.rating).toBe(1);
    });

    it('INT-M-R-017 not-found: unknown id -> 404', async () => {
      const res = await api.put('/api/restaurants/665f00000000000000000000').send({ name: 'x' });
      expect(res.status).toBe(404);
    });

    it('INT-M-R-018 auth-gap: mass-assignment of owner_id / is_active on generic PUT -> 200 [GAP]', async () => {
      const created = await createOne();
      const res = await api.put(`/api/restaurants/${created.body._id}`).send({ owner_id: 'attacker', is_active: false });
      log('018', 'mass assignment PUT', res.status, { owner_id: res.body.owner_id, is_active: res.body.is_active });
      expect(res.status).toBe(200);
      expect(res.body.owner_id).toBe('attacker');
      expect(res.body.is_active).toBe(false);
    });
  });

  describe('PATCH /:restaurantId/owner', () => {
    it('INT-M-R-019 success: valid owner_id -> 200', async () => {
      const created = await createOne();
      const res = await api.patch(`/api/restaurants/${created.body._id}/owner`).send({ owner_id: 'new-owner' });
      expect(res.status).toBe(200);
      expect(res.body.owner_id).toBe('new-owner');
    });

    it('INT-M-R-020 validation: missing owner_id -> 400 "Owner ID is required" (SPEC: 400)', async () => {
      const created = await createOne();
      const res = await api.patch(`/api/restaurants/${created.body._id}/owner`).send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Owner ID is required');
    });

    it('INT-M-R-021 not-found: unknown id -> 404', async () => {
      const res = await api.patch('/api/restaurants/665f00000000000000000000/owner').send({ owner_id: 'x' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /:restaurantId', () => {
    it('INT-M-R-022 success: delete existing -> 200 + message', async () => {
      const created = await createOne();
      const res = await api.delete(`/api/restaurants/${created.body._id}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Restaurant deleted successfully');
    });

    it('INT-M-R-023 not-found: unknown id -> 404', async () => {
      const res = await api.delete('/api/restaurants/665f00000000000000000000');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /:restaurantId/details', () => {
    it('INT-M-R-024 success: returns { categories, menuItems } arrays', async () => {
      const created = await createOne();
      const res = await api.get(`/api/restaurants/${created.body._id}/details`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('categories');
      expect(res.body).toHaveProperty('menuItems');
    });

    it('INT-M-R-025 success: unknown restaurant id -> 200 with EMPTY arrays (no 404; documented)', async () => {
      const res = await api.get('/api/restaurants/665f00000000000000000000/details');
      log('025', 'unknown id details', res.status, res.body);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ categories: [], menuItems: [] });
    });
  });

  describe('GET /owner/:ownerId', () => {
    it("INT-M-R-026 success: returns only that owner's restaurants -> 200 array", async () => {
      await createOne(); // owner-123
      await createOne({ ...validRestaurant, owner_id: 'other-owner', name: 'Other' });
      const res = await api.get('/api/restaurants/owner/owner-123');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].owner_id).toBe('owner-123');
    });

    it('INT-M-R-027 success: unknown owner -> 200 []', async () => {
      const res = await api.get('/api/restaurants/owner/nobody');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});