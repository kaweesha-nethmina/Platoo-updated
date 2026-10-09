/**
 * BLACK-BOX functional tests - menu-service /api/menu-items (SE4030).
 * POST-FIX verification suite: asserts secure behaviour after the fixes,
 * including the price min:0 validation (VULN-04) and authenticated writes (VULN-01).
 */
import request from 'supertest';
import app from '../../src/app';
import { connectAndReset, disconnectDb } from '../helpers/db';
import { validUserToken } from '../helpers/tokens';

const api = request(app);
const AUTH = { Authorization: 'Bearer ' + validUserToken('it-menu-user-1') };

let restaurantId = '';
let categoryId = '';

beforeAll(async () => {
  await connectAndReset();
  const r = await api.post('/api/restaurants').set(AUTH).send({
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
  const c = await api.post('/api/category').set(AUTH).send({
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
    it('TC-BB-033 valid menu item (with auth) -> 201', async () => {
      const res = await api.post('/api/menu-items').set(AUTH).send(validItem());
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('_id');
    });

    it('TC-BB-034 price as string "1200" is coerced to number 1200 (VULN-04 fix keeps coercion)', async () => {
      const res = await api.post('/api/menu-items').set(AUTH).send({ ...validItem(), price: '1200' });
      expect(res.status).toBe(201);
      expect(res.body.price).toBe(1200);
    });

    it('TC-BB-035 NEGATIVE price REJECTED -> 400 (VULN-04 min:0 enforced)', async () => {
      const res = await api.post('/api/menu-items').set(AUTH).send({ ...validItem(), price: -500 });
      expect(res.status).toBe(400);
    });

    it('TC-BB-036 empty body -> 400 (ValidationError handled centrally)', async () => {
      const res = await api.post('/api/menu-items').set(AUTH).send({});
      expect(res.status).toBe(400);
    });

    it('TC-BB-037 XSS payload in name/description stored verbatim (VULN-14 XSS still open)', async () => {
      const res = await api.post('/api/menu-items').set(AUTH).send({
        ...validItem(),
        name: '<img src=x onerror=alert(1)>',
        description: '<script>document.cookie</script>',
      });
      expect(res.status).toBe(201);
      expect(res.body.name).toContain('<img');
      expect(res.body.description).toContain('<script>');
    });

    it('TC-BB-038 non-ObjectId category_id -> 400 (CastError, no 500 leak)', async () => {
      const res = await api.post('/api/menu-items').set(AUTH).send({ ...validItem(), category_id: 'nope' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /', () => {
    it('TC-BB-039 returns 200 + array (public read)', async () => {
      const res = await api.get('/api/menu-items');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /category/:categoryId', () => {
    it('TC-BB-040 valid category -> 200 + array (public read)', async () => {
      const res = await api.get(`/api/menu-items/category/${categoryId}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /restaurant/:restaurantId', () => {
    it('TC-BB-041 valid restaurant -> 200 + array (public read)', async () => {
      const res = await api.get(`/api/menu-items/restaurant/${restaurantId}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /:menuItemId/image', () => {
    it('TC-BB-042 returns image_url wrapper (public read)', async () => {
      const created = (await api.post('/api/menu-items').set(AUTH).send(validItem())).body;
      const res = await api.get(`/api/menu-items/${created._id}/image`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('image_url');
    });

    it('TC-BB-043 missing item -> 404', async () => {
      const res = await api.get('/api/menu-items/665f00000000000000000000/image');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /:menuItemId', () => {
    it('TC-BB-044 update valid item (with auth) -> 200', async () => {
      const created = (await api.post('/api/menu-items').set(AUTH).send(validItem())).body;
      const res = await api.put(`/api/menu-items/${created._id}`).set(AUTH).send({ price: 500 });
      expect(res.status).toBe(200);
      expect(res.body.price).toBe(500);
    });

    it('TC-BB-045 MASS ASSIGNMENT blocked: legit fields editable, unknown fields stripped', async () => {
      const created = (await api.post('/api/menu-items').set(AUTH).send(validItem())).body;
      const res = await api
        .put(`/api/menu-items/${created._id}`)
        .set(AUTH)
        .send({ price: 1, is_available: false, evil_owner: 'attacker' });
      expect(res.status).toBe(200);
      expect(res.body.price).toBe(1);
      expect(res.body.is_available).toBe(false);
      expect(res.body.evil_owner).toBeUndefined();
    });
  });

  describe('DELETE /:menuItemId', () => {
    it('TC-BB-046 delete non-existent item -> 404 (previously 200 with success message)', async () => {
      const res = await api.delete('/api/menu-items/665f00000000000000000000').set(AUTH);
      expect(res.status).toBe(404);
    });

    it('TC-BB-047 delete valid item (with auth) -> 200', async () => {
      const created = (await api.post('/api/menu-items').set(AUTH).send(validItem())).body;
      const res = await api.delete(`/api/menu-items/${created._id}`).set(AUTH);
      expect(res.status).toBe(200);
    });
  });
});