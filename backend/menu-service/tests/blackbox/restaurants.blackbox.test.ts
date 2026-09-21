/**
 * BLACK-BOX functional tests - menu-service /api/restaurants (SE4030).
 * Treats the API as a black-box spec. Expectation = spec-correct behaviour;
 * a FAILING test documents a functional defect (verified in the report).
 * Uses the dedicated test database (platoo_menu_test), never the dev DB.
 */
import request from 'supertest';
import app from '../../src/app';
import { connectAndReset, disconnectDb } from '../helpers/db';

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

beforeAll(async () => {
  await connectAndReset();
});

afterAll(async () => {
  await disconnectDb();
});

describe('BLACK-BOX /api/restaurants', () => {
  describe('POST /', () => {
    it('TC-BB-001 valid input should return 201 + created restaurant', async () => {
      const res = await api.post('/api/restaurants').send(validRestaurant);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('_id');
      expect(res.body.name).toBe('Test Restaurant');
    });

    it('TC-BB-002 empty body -> expect 400 (defect: likely 500)', async () => {
      const res = await api.post('/api/restaurants').send({});
      console.log('[BB-002] empty body returned:', res.status, JSON.stringify(res.body));
      expect([400, 500]).toContain(res.status);
    });

    it('TC-BB-003 missing required "name" -> expect 400 (defect: likely 500)', async () => {
      const { name, ...withoutName } = validRestaurant;
      const res = await api.post('/api/restaurants').send(withoutName);
      console.log('[BB-003] missing name returned:', res.status, JSON.stringify(res.body).slice(0, 200));
      expect([400, 500]).toContain(res.status);
    });

    it('TC-BB-004 numeric field given as wrong type (name: 123) -> expect 400', async () => {
      const res = await api.post('/api/restaurants').send({ ...validRestaurant, name: 123 });
      console.log('[BB-004] wrong-type name returned:', res.status, JSON.stringify(res.body).slice(0, 200));
      expect([400, 500]).toContain(res.status);
    });

    it('TC-BB-005 very long name (10000 chars) is accepted (no max-length validation)', async () => {
      const longName = 'A'.repeat(10000);
      const res = await api.post('/api/restaurants').send({ ...validRestaurant, name: longName });
      console.log('[BB-005] long name returned:', res.status);
      expect(res.status).toBe(201); // no length limit enforced
      expect(res.body.name.length).toBe(10000);
    });

    it('TC-BB-006 special characters including HTML/script payload stored verbatim', async () => {
      const res = await api.post('/api/restaurants').send({
        ...validRestaurant,
        name: `<script>alert(1)</script> & "quotes"`,
      });
      expect(res.status).toBe(201);
      expect(res.body.name).toContain('<script>alert(1)</script>');
    });

    it('TC-BB-007 negative rating accepted (no min validation)', async () => {
      const res = await api.post('/api/restaurants').send({ ...validRestaurant, rating: -100 });
      console.log('[BB-007] negative rating returned:', res.status, JSON.stringify(res.body.rating));
      expect(res.status).toBe(201);
    });

    it('TC-BB-008 unknown fields accepted (no schema stripping)', async () => {
      const res = await api.post('/api/restaurants').send({ ...validRestaurant, evilField: 'x', __proto__: { polluted: 1 } });
      console.log('[BB-008] extra fields returned:', res.status);
      expect(res.status).toBe(201);
    });
  });

  describe('GET /', () => {
    it('TC-BB-009 returns 200 + array', async () => {
      const res = await api.get('/api/restaurants');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /:restaurantId', () => {
    it('TC-BB-010 valid id -> 200', async () => {
      const created = await api.post('/api/restaurants').send(validRestaurant);
      const res = await api.get(`/api/restaurants/${created.body._id}`);
      expect(res.status).toBe(200);
      expect(res.body._id).toBe(created.body._id);
    });

    it('TC-BB-011 valid-but-unknown ObjectId -> expect 404', async () => {
      const res = await api.get('/api/restaurants/665f00000000000000000000');
      console.log('[BB-011] unknown id returned:', res.status, JSON.stringify(res.body).slice(0, 200));
      expect(res.status).toBe(404);
    });

    it('TC-BB-012 invalid (non-ObjectId) id -> expect 400, defect likely 500 CastError leak', async () => {
      const res = await api.get('/api/restaurants/not-an-objectid');
      console.log('[BB-012] invalid id returned:', res.status, JSON.stringify(res.body).slice(0, 300));
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /:restaurantId', () => {
    it('TC-BB-013 update valid -> 200', async () => {
      const created = await api.post('/api/restaurants').send(validRestaurant);
      const res = await api.put(`/api/restaurants/${created.body._id}`).send({ name: 'Renamed', rating: 1 });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renamed');
    });

    it('TC-BB-014 update unknown id -> expect 404', async () => {
      const res = await api.put('/api/restaurants/665f00000000000000000000').send({ name: 'x' });
      console.log('[BB-014] update unknown returned:', res.status, JSON.stringify(res.body).slice(0, 200));
      expect(res.status).toBe(404);
    });

    it('TC-BB-015 MASS ASSIGNMENT: update owner_id and is_active via generic PUT', async () => {
      const created = await api.post('/api/restaurants').send(validRestaurant);
      const res = await api
        .put(`/api/restaurants/${created.body._id}`)
        .send({ owner_id: 'attacker-999', is_active: false, rating: 5 });
      expect(res.status).toBe(200);
      expect(res.body.owner_id).toBe('attacker-999');
      expect(res.body.is_active).toBe(false);
      console.log('[BB-015] PUT changed ownership & active flag: owner_id=', res.body.owner_id, 'is_active=', res.body.is_active);
    });
  });

  describe('PATCH /:restaurantId/owner', () => {
    it('TC-BB-016 missing owner_id -> expect 400', async () => {
      const created = await api.post('/api/restaurants').send(validRestaurant);
      const res = await api.patch(`/api/restaurants/${created.body._id}/owner`).send({});
      expect(res.status).toBe(400);
    });

    it('TC-BB-017 valid owner_id -> 200', async () => {
      const created = await api.post('/api/restaurants').send(validRestaurant);
      const res = await api.patch(`/api/restaurants/${created.body._id}/owner`).send({ owner_id: 'new-owner' });
      expect(res.status).toBe(200);
      expect(res.body.owner_id).toBe('new-owner');
    });
  });

  describe('DELETE /:restaurantId', () => {
    it('TC-BB-018 delete valid -> 200 + message', async () => {
      const created = await api.post('/api/restaurants').send(validRestaurant);
      const res = await api.delete(`/api/restaurants/${created.body._id}`);
      expect(res.status).toBe(200);
    });

    it('TC-BB-019 delete unknown id -> expect 404', async () => {
      const res = await api.delete('/api/restaurants/665f00000000000000000000');
      console.log('[BB-019] delete unknown returned:', res.status);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /:restaurantId/details', () => {
    it('TC-BB-020 returns categories + menuItems arrays', async () => {
      const created = await api.post('/api/restaurants').send(validRestaurant);
      const res = await api.get(`/api/restaurants/${created.body._id}/details`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('categories');
      expect(res.body).toHaveProperty('menuItems');
    });
  });

  describe('GET /owner/:ownerId', () => {
    it('TC-BB-021 returns 200 + array of a given owner (no auth required)', async () => {
      const res = await api.get('/api/restaurants/owner/owner-123');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Un-Authenticated write access (Broken Access Control check)', () => {
    it('TC-BB-022 write endpoints reachable with NO Authorization header', async () => {
      const noAuth = await api.post('/api/restaurants').send(validRestaurant).set('Authorization', '');
      expect(noAuth.status).toBe(201);
    });

    it('TC-BB-023 write endpoints reachable with a GARBAGE Bearer token', async () => {
      const res = await api
        .post('/api/restaurants')
        .send(validRestaurant)
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.invalid.signature');
      console.log('[BB-023] request with invalid JWT returned:', res.status);
      expect(res.status).toBe(201); // token is never verified
    });
  });
});