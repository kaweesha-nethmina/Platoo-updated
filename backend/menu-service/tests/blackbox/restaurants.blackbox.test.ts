/**
 * BLACK-BOX functional tests - menu-service /api/restaurants (SE4030).
 * Now a POST-FIX verification suite: every TC asserts the SECURE behaviour
 * expected after the vulnerability fixes were applied (see hiruni report).
 * Uses the dedicated test database (platoo_menu_test), never the dev DB.
 */
import request from 'supertest';
import app from '../../src/app';
import { connectAndReset, disconnectDb } from '../helpers/db';
import { validUserToken } from '../helpers/tokens';

const api = request(app);
const AUTH = { Authorization: 'Bearer ' + validUserToken('it-menu-user-1') };

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
    it('TC-BB-001 valid input -> 201 + created restaurant (owner_id from token)', async () => {
      const res = await api.post('/api/restaurants').set(AUTH).send(validRestaurant);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('_id');
      expect(res.body.name).toBe('Test Restaurant');
      expect(res.body.owner_id).toBe('it-menu-user-1');
    });

    it('TC-BB-002 empty body -> 400 (ValidationError handled centrally)', async () => {
      const res = await api.post('/api/restaurants').set(AUTH).send({});
      expect(res.status).toBe(400);
    });

    it('TC-BB-003 missing required "name" -> 400 (ValidationError handled centrally)', async () => {
      const { name, ...withoutName } = validRestaurant;
      const res = await api.post('/api/restaurants').set(AUTH).send(withoutName);
      expect(res.status).toBe(400);
    });

    it('TC-BB-004 name given as wrong type (name: 123) is string-coerced by mongoose -> 201', async () => {
      const res = await api.post('/api/restaurants').set(AUTH).send({ ...validRestaurant, name: 123 });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('123');
    });

    it('TC-BB-005 very long name (10000 chars) is accepted (no max-length validation)', async () => {
      const longName = 'A'.repeat(10000);
      const res = await api.post('/api/restaurants').set(AUTH).send({ ...validRestaurant, name: longName });
      expect(res.status).toBe(201);
      expect(res.body.name.length).toBe(10000);
    });

    it('TC-BB-006 special characters including HTML/script payload stored verbatim (VULN-14 XSS still open)', async () => {
      const res = await api.post('/api/restaurants').set(AUTH).send({
        ...validRestaurant,
        name: `<script>alert(1)</script> & "quotes"`,
      });
      expect(res.status).toBe(201);
      expect(res.body.name).toContain('<script>alert(1)</script>');
    });

    it('TC-BB-007 negative rating accepted (no min validation)', async () => {
      const res = await api.post('/api/restaurants').set(AUTH).send({ ...validRestaurant, rating: -100 });
      expect(res.status).toBe(201);
    });

    it('TC-BB-008 unknown fields are STRIPPED by the allow-list (no schema pollution)', async () => {
      const res = await api.post('/api/restaurants').set(AUTH).send({ ...validRestaurant, evilField: 'x' });
      expect(res.status).toBe(201);
      expect(res.body.evilField).toBeUndefined();
    });
  });

  describe('GET /', () => {
    it('TC-BB-009 returns 200 + array (public read)', async () => {
      const res = await api.get('/api/restaurants');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /:restaurantId', () => {
    it('TC-BB-010 valid id -> 200', async () => {
      const created = await api.post('/api/restaurants').set(AUTH).send(validRestaurant);
      const res = await api.get(`/api/restaurants/${created.body._id}`);
      expect(res.status).toBe(200);
      expect(res.body._id).toBe(created.body._id);
    });

    it('TC-BB-011 valid-but-unknown ObjectId -> 404', async () => {
      const res = await api.get('/api/restaurants/665f00000000000000000000');
      expect(res.status).toBe(404);
    });

    it('TC-BB-012 invalid (non-ObjectId) id -> 400 (CastError handled centrally, no 500 leak)', async () => {
      const res = await api.get('/api/restaurants/not-an-objectid');
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /:restaurantId', () => {
    it('TC-BB-013 update valid (with auth) -> 200', async () => {
      const created = await api.post('/api/restaurants').set(AUTH).send(validRestaurant);
      const res = await api.put(`/api/restaurants/${created.body._id}`).set(AUTH).send({ name: 'Renamed', rating: 1 });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renamed');
    });

    it('TC-BB-014 update unknown id -> 404', async () => {
      const res = await api.put('/api/restaurants/665f00000000000000000000').set(AUTH).send({ name: 'x' });
      expect(res.status).toBe(404);
    });

    it('TC-BB-015 MASS ASSIGNMENT blocked: owner_id and is_active cannot be changed via PUT', async () => {
      const created = await api.post('/api/restaurants').set(AUTH).send(validRestaurant);
      const res = await api
        .put(`/api/restaurants/${created.body._id}`)
        .set(AUTH)
        .send({ owner_id: 'attacker-999', is_active: false, rating: 5 });
      expect(res.status).toBe(200);
      expect(res.body.owner_id).toBe('it-menu-user-1'); // NOT attacker-999
      expect(res.body.is_active).toBe(true); // NOT false
      expect(res.body.rating).toBe(5);
    });
  });

  describe('PATCH /:restaurantId/owner', () => {
    it('TC-BB-016 missing owner_id -> 400', async () => {
      const created = await api.post('/api/restaurants').set(AUTH).send(validRestaurant);
      const res = await api.patch(`/api/restaurants/${created.body._id}/owner`).set(AUTH).send({});
      expect(res.status).toBe(400);
    });

    it('TC-BB-017 valid owner_id + auth -> 200', async () => {
      const created = await api.post('/api/restaurants').set(AUTH).send(validRestaurant);
      const res = await api.patch(`/api/restaurants/${created.body._id}/owner`).set(AUTH).send({ owner_id: 'new-owner' });
      expect(res.status).toBe(200);
      expect(res.body.owner_id).toBe('new-owner');
    });
  });

  describe('DELETE /:restaurantId', () => {
    it('TC-BB-018 delete valid (with auth) -> 200 + message', async () => {
      const created = await api.post('/api/restaurants').set(AUTH).send(validRestaurant);
      const res = await api.delete(`/api/restaurants/${created.body._id}`).set(AUTH);
      expect(res.status).toBe(200);
    });

    it('TC-BB-019 delete unknown id -> 404', async () => {
      const res = await api.delete('/api/restaurants/665f00000000000000000000').set(AUTH);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /:restaurantId/details', () => {
    it('TC-BB-020 returns categories + menuItems arrays (public read)', async () => {
      const created = await api.post('/api/restaurants').set(AUTH).send(validRestaurant);
      const res = await api.get(`/api/restaurants/${created.body._id}/details`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('categories');
      expect(res.body).toHaveProperty('menuItems');
    });
  });

  describe('GET /owner/:ownerId', () => {
    it('TC-BB-021 returns 200 + array of restaurants owned by the token user', async () => {
      await api.post('/api/restaurants').set(AUTH).send(validRestaurant);
      const res = await api.get('/api/restaurants/owner/it-menu-user-1');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Broken Access Control (auth enforced on writes)', () => {
    it('TC-BB-022 write endpoints reject requests with NO Authorization header -> 401', async () => {
      const noAuth = await api.post('/api/restaurants').send(validRestaurant);
      expect(noAuth.status).toBe(401);
    });

    it('TC-BB-023 write endpoints reject a GARBAGE Bearer token -> 401', async () => {
      const res = await api
        .post('/api/restaurants')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.invalid.signature')
        .send(validRestaurant);
      expect(res.status).toBe(401);
    });
  });
});