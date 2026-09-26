/**
 * BLACK-BOX functional tests - menu-service /api/category (SE4030).
 * POST-FIX verification suite: asserts the secure behaviour after the
 * vulnerability fixes were applied (requireAuth on mutations, central
 * error handler -> 400 for client errors, 404 for missing docs).
 */
import request from 'supertest';
import app from '../../src/app';
import { connectAndReset, disconnectDb } from '../helpers/db';
import { validUserToken } from '../helpers/tokens';

const api = request(app);
const AUTH = { Authorization: 'Bearer ' + validUserToken('it-menu-user-1') };

let restaurantId = '';

beforeAll(async () => {
  await connectAndReset();
  const r = await api.post('/api/restaurants').set(AUTH).send({
    owner_id: 'owner-123',
    name: 'CatTest Restaurant',
    image: 'http://localhost:3001/uploads/test.png',
    rating: 4,
    deliveryTime: '30 min',
    deliveryFee: 'Rs. 150',
    minOrder: 'Rs. 500',
    distance: '2 km',
    cuisines: ['Local'],
    priceLevel: 2,
    location: { type: 'Point', coordinates: [79.86, 6.92], tag: 'area' },
  });
  restaurantId = r.body._id;
});

afterAll(async () => {
  await disconnectDb();
});

const validCategory = () => ({
  restaurant_id: restaurantId,
  name: 'Burgers',
  description: 'Tasty burgers',
  image_url: 'http://localhost:3001/uploads/burger.png',
  is_active: true,
});

describe('BLACK-BOX /api/category', () => {
  describe('POST /', () => {
    it('TC-BB-024 valid category (with auth) -> 201', async () => {
      const res = await api.post('/api/category').set(AUTH).send(validCategory());
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('_id');
    });

    it('TC-BB-025 empty body -> 400 (ValidationError handled centrally)', async () => {
      const res = await api.post('/api/category').set(AUTH).send({});
      expect(res.status).toBe(400);
    });

    it('TC-BB-026 missing required field (name) -> 400', async () => {
      const { name, ...withoutName } = validCategory();
      const res = await api.post('/api/category').set(AUTH).send(withoutName);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /:restaurantId', () => {
    it('TC-BB-027 returns 200 + array for valid restaurant (public read)', async () => {
      const res = await api.get(`/api/category/${restaurantId}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('TC-BB-028 invalid restaurant ObjectId -> 400 (CastError, no 500 leak)', async () => {
      const res = await api.get('/api/category/not-an-id');
      expect(res.status).toBe(400);
    });
  });

  describe('GET / (all categories)', () => {
    it('TC-BB-029 returns 200 + array (public read, populates restaurant_id)', async () => {
      const res = await api.get('/api/category');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('PUT /:categoryId', () => {
    it('TC-BB-030 update valid category (with auth) -> 200', async () => {
      const created = (await api.post('/api/category').set(AUTH).send(validCategory())).body;
      const res = await api.put(`/api/category/${created._id}`).set(AUTH).send({ name: 'Renamed Cat' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renamed Cat');
    });

    it('TC-BB-031 update non-existent category -> 404 (double-response bug fixed)', async () => {
      const res = await api.put('/api/category/665f00000000000000000000').set(AUTH).send({ name: 'x' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /:categoryId', () => {
    it('TC-BB-032 delete non-existent category -> 404 (previously returned 200)', async () => {
      const res = await api.delete('/api/category/665f00000000000000000000').set(AUTH);
      expect(res.status).toBe(404);
    });
  });
});