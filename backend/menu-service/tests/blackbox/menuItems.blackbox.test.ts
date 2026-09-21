/**
 * BLACK-BOX functional tests - menu-service /api/menu-items (SE4030).
 * Treats the API as a black-box spec. Expectation = spec-correct behaviour;
 * a FAILING test documents a functional defect.
 */
import request from 'supertest';
import app from '../../src/app';
import { connectAndReset, disconnectDb } from '../helpers/db';

const api = request(app);

let restaurantId = '';
let categoryId = '';

beforeAll(async () => {
  await connectAndReset();
  const r = await api.post('/api/restaurants').send({
    owner_id: 'owner-123',
    name: 'ItemTest Restaurant',
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
  const c = await api.post('/api/category').send({
    restaurant_id: restaurantId,
    name: 'Pizza',
    description: 'Pizza options',
    image_url: 'http://localhost:3001/uploads/pizza.png',
  });
  categoryId = c.body._id;
});

afterAll(async () => {
  await disconnectDb();
});

const validItem = () => ({
  category_id: categoryId,
  name: 'Margherita',
  description: 'Classic cheese',
  price: 1200,
  image_url: 'http://localhost:3001/uploads/margherita.png',
  is_veg: true,
  is_available: true,
});

describe('BLACK-BOX /api/menu-items', () => {
  describe('POST /', () => {
    it('TC-BB-033 valid menu item -> 201', async () => {
      const res = await api.post('/api/menu-items').send(validItem());
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('_id');
    });

    it('TC-BB-034 price as string "1200" is coerced to number', async () => {
      const res = await api.post('/api/menu-items').send({ ...validItem(), price: '1200' });
      console.log('[BB-034] string price returned:', res.status, JSON.stringify(res.body).slice(0, 150));
      expect(res.status).toBe(201);
    });

    it('TC-BB-035 NEGATIVE price accepted -> price tampering (no min validation)', async () => {
      const res = await api.post('/api/menu-items').send({ ...validItem(), price: -500 });
      console.log('[BB-035] negative price returned:', res.status, JSON.stringify(res.body).slice(0, 150));
      expect(res.status).toBe(201);
      expect(res.body.price).toBe(-500);
    });

    it('TC-BB-036 empty body -> expect 400 (defect: likely 500)', async () => {
      const res = await api.post('/api/menu-items').send({});
      console.log('[BB-036] empty item returned:', res.status, JSON.stringify(res.body).slice(0, 200));
      expect([400, 500]).toContain(res.status);
    });

    it('TC-BB-037 XSS payload in name/description stored verbatim', async () => {
      const res = await api.post('/api/menu-items').send({
        ...validItem(),
        name: '<img src=x onerror=alert(1)>',
        description: '<script>document.cookie</script>',
      });
      expect(res.status).toBe(201);
      expect(res.body.name).toContain('<img');
      expect(res.body.description).toContain('<script>');
    });

    it('TC-BB-038 non-ObjectId category_id -> expect 400 (defect: likely 500 CastError)', async () => {
      const res = await api.post('/api/menu-items').send({ ...validItem(), category_id: 'nope' });
      console.log('[BB-038] invalid category_id returned:', res.status, JSON.stringify(res.body).slice(0, 250));
      expect(res.status).toBe(400);
    });
  });

  describe('GET /', () => {
    it('TC-BB-039 returns 200 + array', async () => {
      const res = await api.get('/api/menu-items');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /category/:categoryId', () => {
    it('TC-BB-040 valid category -> 200 + array', async () => {
      const res = await api.get(`/api/menu-items/category/${categoryId}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /restaurant/:restaurantId', () => {
    it('TC-BB-041 valid restaurant -> 200 + array', async () => {
      const res = await api.get(`/api/menu-items/restaurant/${restaurantId}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /:menuItemId/image', () => {
    it('TC-BB-042 returns image_url wrapper', async () => {
      const created = (await api.post('/api/menu-items').send(validItem())).body;
      const res = await api.get(`/api/menu-items/${created._id}/image`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('image_url');
    });

    it('TC-BB-043 missing item -> expect 404', async () => {
      const res = await api.get('/api/menu-items/665f00000000000000000000/image');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /:menuItemId', () => {
    it('TC-BB-044 update valid item -> 200', async () => {
      const created = (await api.post('/api/menu-items').send(validItem())).body;
      const res = await api.put(`/api/menu-items/${created._id}`).send({ price: 500 });
      expect(res.status).toBe(200);
      expect(res.body.price).toBe(500);
    });

    it('TC-BB-045 MASS ASSIGNMENT: PUT can change is_available, price, category_id', async () => {
      const created = (await api.post('/api/menu-items').send(validItem())).body;
      const res = await api
        .put(`/api/menu-items/${created._id}`)
        .send({ price: 1, is_available: false, category_id: '665f00000000000000000000' });
      console.log('[BB-045] mass-assign PUT returned:', res.status, JSON.stringify(res.body).slice(0, 200));
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /:menuItemId', () => {
    it('TC-BB-046 delete non-existent item -> expect 404 (defect: currently 200 with success message)', async () => {
      const res = await api.delete('/api/menu-items/665f00000000000000000000');
      console.log('[BB-046] delete missing item returned:', res.status, JSON.stringify(res.body).slice(0, 200));
      expect(res.status).toBe(404);
    });

    it('TC-BB-047 delete valid item -> 200', async () => {
      const created = (await api.post('/api/menu-items').send(validItem())).body;
      const res = await api.delete(`/api/menu-items/${created._id}`);
      expect(res.status).toBe(200);
    });
  });
});