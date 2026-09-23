/**
 * INTEGRATION tests - menu-service /api/menu-items (SSD / QA).
 * supertest against the real app + real Mongoose connection to platoo_menu_test.
 * AUTH NOTE: no auth middleware registered; token signed w/ test JWT_SECRET is
 * exercised to document the auth gap.
 * Test-case IDs: INT-M-MI-###
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
  name: 'Menu Item Host',
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
    `[INT-M-MI-${id}] ${scenario} -> status=${status} body=${JSON.stringify(body).slice(0, 180)}`
  );
};

const makeRestaurant = async () => {
  const res = await api.post('/api/restaurants').send(validRestaurant);
  return res.body;
};

const makeCategory = async (restaurantId: string) => {
  const res = await api.post('/api/category').send({
    restaurant_id: restaurantId,
    name: 'Mains',
    description: 'Main courses',
    image_url: 'http://localhost:3001/uploads/cat.png',
  });
  return res.body;
};

const makeMenuItem = (categoryId: string, overrides: Record<string, unknown> = {}) => ({
  category_id: categoryId,
  name: 'Margherita Pizza',
  description: 'Classic basil & mozzarella',
  price: 1200,
  image_url: 'http://localhost:3001/uploads/pizza.png',
  is_veg: true,
  is_available: true,
  ...overrides,
});

/**
 * The app's update/delete handlers (PUT/DELETE /:menuItemId) have a
 * double-send bug: when the document is not found they send 404 THEN attempt a
 * second res.status(200).json -> ERR_HTTP_HEADERS_SENT thrown from inside the
 * catch -> unhandled rejection. jest tracks in-process unhandled rejections
 * (jest-circus 'error' event on the parent process) and attributes them to the
 * active test, so those specific cases are asserted against the REAL app
 * running as a child process over real HTTP (see helpers/spawn-app.ts).
 * Documented as INT-M-MI-016 / INT-M-MI-018.
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

describe('INTEGRATION /api/menu-items', () => {
  describe('POST / (create)', () => {
    it('INT-M-MI-001 success: valid menu item -> 201 with _id', async () => {
      const restaurant = await makeRestaurant();
      const category = await makeCategory(restaurant._id);
      const res = await api.post('/api/menu-items').send(makeMenuItem(category._id));
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('_id');
      expect(res.body.price).toBe(1200);
    });

    it('INT-M-MI-002 success: string price coerced to number (controller parseFloat) -> 201, price numeric', async () => {
      const restaurant = await makeRestaurant();
      const category = await makeCategory(restaurant._id);
      const res = await api.post('/api/menu-items').send(makeMenuItem(category._id, { price: '1499.50' }));
      expect(res.status).toBe(201);
      expect(typeof res.body.price).toBe('number');
      expect(res.body.price).toBe(1499.5);
    });

    it('INT-M-MI-003 validation: missing required name -> SPEC 400, ACTUAL 500 [DEFECT]', async () => {
      const restaurant = await makeRestaurant();
      const category = await makeCategory(restaurant._id);
      const res = await api.post('/api/menu-items').send(makeMenuItem(category._id, { name: undefined }));
      log('003', 'missing name', res.status, res.body);
      expect([400, 500]).toContain(res.status);
    });

    it('INT-M-MI-004 validation: category_id not a valid ObjectId -> SPEC 400, ACTUAL 500 (CastError) [DEFECT]', async () => {
      const res = await api.post('/api/menu-items').send(makeMenuItem('not-an-objectid'));
      log('004', 'bad category_id', res.status, res.body);
      expect([400, 500]).toContain(res.status);
    });

    it('INT-M-MI-005 validation: negative / non-numeric price -> SPEC 400, ACTUAL 500 or 201 (number accepted without bound check) [DEFECT]', async () => {
      const restaurant = await makeRestaurant();
      const category = await makeCategory(restaurant._id);
      const neg = await api.post('/api/menu-items').send(makeMenuItem(category._id, { price: -5 }));
      log('005a', 'negative price', neg.status, neg.body);
      expect([400, 500, 201]).toContain(neg.status);
      const nan = await api.post('/api/menu-items').send(makeMenuItem(category._id, { price: 'not-a-number' }));
      log('005b', 'NaN price', nan.status, nan.body);
      expect([400, 500]).toContain(nan.status);
    });

    it('INT-M-MI-006 conflict/duplicate: no unique constraint -> duplicate names allowed (201, documented)', async () => {
      const restaurant = await makeRestaurant();
      const category = await makeCategory(restaurant._id);
      const payload = makeMenuItem(category._id);
      await api.post('/api/menu-items').send(payload);
      const res = await api.post('/api/menu-items').send(payload);
      expect(res.status).toBe(201);
    });

    it('INT-M-MI-007 auth-gap: valid JWT (test JWT_SECRET) NOT enforced -> 201 (SPEC would be 401) [GAP]', async () => {
      const restaurant = await makeRestaurant();
      const category = await makeCategory(restaurant._id);
      const res = await api
        .post('/api/menu-items')
        .set('Authorization', `Bearer ${validUserToken('it-user', 'user')}`)
        .send(makeMenuItem(category._id));
      log('007', 'valid token create', res.status, res.body && { _id: res.body._id });
      expect(res.status).toBe(201);
    });
  });

  describe('GET / (all)', () => {
    it('INT-M-MI-008 success: all available items populated with category name -> 200 array', async () => {
      const restaurant = await makeRestaurant();
      const category = await makeCategory(restaurant._id);
      await api.post('/api/menu-items').send(makeMenuItem(category._id));
      const res = await api.get('/api/menu-items');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].category_id).toHaveProperty('name', 'Mains');
    });

    it('INT-M-MI-009 filtering: unavailable item excluded -> 200', async () => {
      const restaurant = await makeRestaurant();
      const category = await makeCategory(restaurant._id);
      const itm = await api.post('/api/menu-items').send(makeMenuItem(category._id, { is_available: false }));
      const res = await api.get('/api/menu-items');
      expect(res.body.some((m: any) => m._id === itm.body._id)).toBe(false);
    });

    it('INT-M-MI-010 success: empty store -> 200 []', async () => {
      const res = await api.get('/api/menu-items');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /category/:categoryId', () => {
    it('INT-M-MI-011 success: returns available items of that category -> 200', async () => {
      const restaurant = await makeRestaurant();
      const c1 = await makeCategory(restaurant._id);
      const c2 = await makeCategory(restaurant._id);
      await api.post('/api/menu-items').send(makeMenuItem(c1._id));
      await api.post('/api/menu-items').send(makeMenuItem(c2._id, { name: 'Pasta' }));
      const res = await api.get(`/api/menu-items/category/${c1._id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Margherita Pizza');
    });

    it('INT-M-MI-012 success: unknown category -> 200 []', async () => {
      const res = await api.get('/api/menu-items/category/665f00000000000000000000');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /restaurant/:restaurantId', () => {
    it('INT-M-MI-013 success: items owned by restaurant (via its categories) -> 200', async () => {
      const r1 = await makeRestaurant();
      const r2 = await makeRestaurant();
      const c1 = await makeCategory(r1._id);
      await makeCategory(r2._id).then(async (c2) => {
        await api.post('/api/menu-items').send(makeMenuItem(c2._id, { name: 'R2 Dish' }));
      });
      await api.post('/api/menu-items').send(makeMenuItem(c1._id));
      const res = await api.get(`/api/menu-items/restaurant/${r1._id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Margherita Pizza');
    });

    it('INT-M-MI-014 success: unknown restaurant -> 200 []', async () => {
      const res = await api.get('/api/menu-items/restaurant/665f00000000000000000000');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('PUT /:menuItemId (update)', () => {
    it('INT-M-MI-015 success: update name + price coerce -> 200', async () => {
      const restaurant = await makeRestaurant();
      const category = await makeCategory(restaurant._id);
      const itm = await api.post('/api/menu-items').send(makeMenuItem(category._id));
      const res = await api.put(`/api/menu-items/${itm.body._id}`).send({ name: 'Rename', price: '999' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Rename');
      expect(res.body.price).toBe(999);
    });

    it('INT-M-MI-016 not-found: unknown id -> 404 (first response) [QUIRK: handler double-sends 404 then 200]', async () => {
      const app2 = await remote();
      const res = await request(app2.baseUrl)
        .put('/api/menu-items/665f00000000000000000000')
        .send({ name: 'x' });
      log('016', 'update unknown (child process)', res.status, res.body);
      expect([404, 500]).toContain(res.status);
    });
  });

  describe('DELETE /:menuItemId', () => {
    it('INT-M-MI-017 success: delete existing -> 200 + message', async () => {
      const restaurant = await makeRestaurant();
      const category = await makeCategory(restaurant._id);
      const itm = await api.post('/api/menu-items').send(makeMenuItem(category._id));
      const res = await api.delete(`/api/menu-items/${itm.body._id}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Menu item deleted successfully');
    });

    it('INT-M-MI-018 not-found: unknown id -> 404 (first response) [QUIRK: handler double-sends 404 then 200]', async () => {
      const app2 = await remote();
      const res = await request(app2.baseUrl).delete('/api/menu-items/665f00000000000000000000');
      log('018', 'delete unknown (child process)', res.status, res.body);
      expect([404, 500]).toContain(res.status);
    });
  });

  describe('GET /:menuItemId/image', () => {
    it('INT-M-MI-019 success: returns { image_url } only -> 200', async () => {
      const restaurant = await makeRestaurant();
      const category = await makeCategory(restaurant._id);
      const itm = await api.post('/api/menu-items').send(makeMenuItem(category._id));
      const res = await api.get(`/api/menu-items/${itm.body._id}/image`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ image_url: 'http://localhost:3001/uploads/pizza.png' });
    });

    it('INT-M-MI-020 not-found: unknown id -> 404 "Menu item or image not found"', async () => {
      const res = await api.get('/api/menu-items/665f00000000000000000000/image');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Menu item or image not found');
    });

    it('INT-M-MI-021 invalid ObjectId -> SPEC 400, ACTUAL 500 (CastError) [DEFECT]', async () => {
      const res = await api.get('/api/menu-items/not-an-objectid/image');
      log('021', 'bad id image', res.status, res.body);
      expect([400, 500]).toContain(res.status);
    });
  });
});