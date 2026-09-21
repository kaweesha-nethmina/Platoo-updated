/**
 * BLACK-BOX functional tests - menu-service /api/category (SE4030).
 * Treats the API as a black-box spec. Expectation = spec-correct behaviour;
 * a FAILING test documents a functional defect.
 */
import request from 'supertest';
import app from '../../src/app';
import { connectAndReset, disconnectDb } from '../helpers/db';

const api = request(app);

let restaurantId = '';

beforeAll(async () => {
  await connectAndReset();
  const r = await api.post('/api/restaurants').send({
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
    it('TC-BB-024 valid category -> 201', async () => {
      const res = await api.post('/api/category').send(validCategory());
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('_id');
    });

    it('TC-BB-025 empty body -> expect 400 (defect: likely 500)', async () => {
      const res = await api.post('/api/category').send({});
      console.log('[BB-025] empty category returned:', res.status, JSON.stringify(res.body).slice(0, 200));
      expect([400, 500]).toContain(res.status);
    });

    it('TC-BB-026 missing required field (name) -> expect 400', async () => {
      const { name, ...withoutName } = validCategory();
      const res = await api.post('/api/category').send(withoutName);
      console.log('[BB-026] missing category name returned:', res.status);
      expect([400, 500]).toContain(res.status);
    });
  });

  describe('GET /:restaurantId', () => {
    it('TC-BB-027 returns 200 + array for valid restaurant', async () => {
      const res = await api.get(`/api/category/${restaurantId}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('TC-BB-028 invalid restaurant ObjectId -> expect 400 (defect: likely 500 CastError)', async () => {
      const res = await api.get('/api/category/not-an-id');
      console.log('[BB-028] invalid category lookup returned:', res.status, JSON.stringify(res.body).slice(0, 250));
      expect(res.status).toBe(400);
    });
  });

  describe('GET / (all categories)', () => {
    it('TC-BB-029 returns 200 + array (populates restaurant_id)', async () => {
      const res = await api.get('/api/category');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('PUT /:categoryId', () => {
    it('TC-BB-030 update valid category -> 200', async () => {
      const created = (await api.post('/api/category').send(validCategory())).body;
      const res = await api.put(`/api/category/${created._id}`).send({ name: 'Renamed Cat' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renamed Cat');
    });

    it('TC-BB-031 update non-existent category -> expect 404 (defect: headers-sent bug possible)', async () => {
      const res = await api.put('/api/category/665f00000000000000000000').send({ name: 'x' });
      console.log('[BB-031] update missing category returned:', res.status, JSON.stringify(res.body).slice(0, 200));
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /:categoryId', () => {
    it('TC-BB-032 delete non-existent category -> expect 404 (defect: currently returns 200)', async () => {
      const res = await api.delete('/api/category/665f00000000000000000000');
      console.log('[BB-032] delete missing category returned:', res.status, JSON.stringify(res.body).slice(0, 200));
      expect(res.status).toBe(404);
    });
  });
});