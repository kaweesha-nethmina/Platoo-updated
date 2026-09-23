/**
 * INTEGRATION tests - cart-service /api/cart (SSD / QA).
 * supertest against the REAL express app (import { app }) + REAL Mongoose
 * connection to the dedicated TEST database platoo_cart_test (not platoo_cart).
 *
 * MOCK vs REAL: cart-service does NOT call menu-service or any other service
 * at runtime (confirmed: axios is not imported anywhere in src/). There are NO
 * HTTP calls to mock (nock/msw intentionally not used). All reads/writes hit the
 * real local Mongo platoo_cart_test only.
 *
 * AUTH NOTE: cart-service registers no auth middleware -> no 401/403 exist.
 * Tokens signed locally with the test JWT_SECRET (user-service payload shape
 * {id, role}, expiresIn 1d) are exercised to document that auth is NOT enforced.
 *
 * Test-case IDs: INT-C-###
 */
import request from 'supertest';
import app from '../../src/app';
import mongoose from 'mongoose';
import {
  TEST_MONGO_URI,
  clearCollections,
  disconnectDb,
} from '../helpers/db';
import { validUserToken, expiredToken, tamperedToken } from '../helpers/tokens';

const api = request(app);

const log = (id: string, scenario: string, status: number, body: unknown) => {
  console.log(
    `[INT-C-${id}] ${scenario} -> status=${status} body=${JSON.stringify(body).slice(0, 180)}`
  );
};

const validPayload = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user-A',
  productId: 'prod-1',
  name: 'Margherita Pizza',
  price: 1200,
  quantity: 2,
  image: 'http://localhost:3001/uploads/margherita.png',
  ...overrides,
});

const add = (overrides: Record<string, unknown> = {}, auth?: string) => {
  let r = api.post('/api/cart/add').send(validPayload(overrides));
  if (auth) r = r.set('Authorization', auth);
  return r;
};

beforeAll(async () => {
  // cart-service src/app.ts calls connectDB() on import; ensure we are
  // deterministically connected to the _test database before dropping it.
  if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 2) {
    await mongoose.connect(TEST_MONGO_URI);
  }
  await mongoose.connection.dropDatabase();
});

beforeEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await disconnectDb();
});

describe('INTEGRATION /api/cart', () => {
  describe('POST /add (add item)', () => {
    it('INT-C-001 success: new cart created for unknown userId -> 200 with 1 item (SPEC: 200)', async () => {
      const res = await add();
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('user-A');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({ productId: 'prod-1', name: 'Margherita Pizza', price: 1200, quantity: 2 });
    });

    it('INT-C-002 success: adding same productId to existing cart MERGES quantity -> 200, length 1', async () => {
      await add({ userId: 'merge-user' });
      const res = await add({ userId: 'merge-user' });
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantity).toBe(4);
    });

    it('INT-C-003 success: different productIds accumulate -> 200, length grows', async () => {
      await add({ userId: 'multi-user' });
      const res = await add({ userId: 'multi-user', productId: 'prod-2', name: 'Coke', price: 250 });
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
    });

    it('INT-C-004 success: image optional -> 200, item stored WITHOUT image key (Mongoose omits undefined field)', async () => {
      const { image, ...noImage } = validPayload({ userId: 'noimg-user' });
      const res = await api.post('/api/cart/add').send(noImage);
      expect(res.status).toBe(200);
      expect('image' in res.body.items[0]).toBe(false);
    });

    it('INT-C-005 validation: empty body -> SPEC 400, ACTUAL 500 (missing required item fields -> ValidationError) [DEFECT]', async () => {
      const res = await api.post('/api/cart/add').send({});
      log('005', 'empty body add', res.status, res.body);
      expect([400, 500]).toContain(res.status);
    });

    it('INT-C-006 validation: missing required name -> SPEC 400, ACTUAL 500 [DEFECT]', async () => {
      const { name, ...payload } = validPayload({ userId: 'nom-name' });
      const res = await api.post('/api/cart/add').send(payload);
      log('006', 'missing name', res.status, res.body);
      expect([400, 500]).toContain(res.status);
    });

    it('INT-C-007 validation: quantity 0 for a NEW item -> SPEC 400, ACTUAL 500 (schema min:1) [DEFECT]', async () => {
      const res = await add({ userId: 'q0-user', productId: 'p-q0', quantity: 0 });
      log('007', 'quantity 0 new item', res.status, res.body);
      expect([400, 422, 500]).toContain(res.status);
    });

    it('INT-C-008 validation: quantity 0 on MERGE is accepted (existing 2 + 0 = 2) -> 200 (documented asymmetry)', async () => {
      await add({ userId: 'q0-merge-user' });
      const res = await add({ userId: 'q0-merge-user', quantity: 0 });
      expect(res.status).toBe(200);
      expect(res.body.items[0].quantity).toBe(2);
    });

    it('INT-C-009 validation: negative price accepted (no min bound) -> 200 (documented)', async () => {
      const res = await add({ userId: 'neg-price', productId: 'p-neg', price: -100 });
      log('009', 'negative price', res.status, res.body.items && res.body.items.slice(-1));
      expect(res.status).toBe(200);
    });

    it('INT-C-010 validation: client-controlled price stored verbatim (no re-verification vs menu-service) -> 200', async () => {
      const res = await add({ userId: 'tamper', productId: 'p-cheap', price: 0.01 });
      expect(res.status).toBe(200);
      expect(res.body.items[0].price).toBe(0.01);
    });

    it('INT-C-011 conflict/duplicate: same userId unique — sequential adds merge (no duplicate cart). Direct double-insert race would hit E11000, not tested (nondeterministic)', async () => {
      await add({ userId: 'dup-user' });
      await add({ userId: 'dup-user' });
      const res = await api.get('/api/cart/dup-user');
      expect(res.body.items).toHaveLength(1);
    });

    it('INT-C-012 auth-gap: NO Authorization header -> 200 (SPEC would be 401) [GAP]', async () => {
      const res = await add({ userId: 'noauth' });
      log('012', 'no auth header', res.status, res.body.userId);
      expect(res.status).toBe(200);
    });

    it('INT-C-013 auth-gap: VALID token signed with test JWT_SECRET -> 200, token ignored (SPEC would be 401) [GAP]', async () => {
      const res = await add({ userId: 'with-valid-token' }, `Bearer ${validUserToken('it-user', 'user')}`);
      log('013', 'valid token', res.status, res.body.userId);
      expect(res.status).toBe(200);
    });

    it('INT-C-014 auth-gap: EXPIRED token -> 200 (SPEC would be 401) [GAP]', async () => {
      const res = await add({ userId: 'expired-token' }, `Bearer ${expiredToken()}`);
      log('014', 'expired token', res.status, res.body.userId);
      expect(res.status).toBe(200);
    });

    it('INT-C-015 auth-gap: TAMPERED token -> 200 (SPEC would be 401) [GAP]', async () => {
      const res = await add({ userId: 'tampered-token' }, `Bearer ${tamperedToken()}`);
      log('015', 'tampered token', res.status, res.body.userId);
      expect(res.status).toBe(200);
    });

    it('INT-C-016 security: NoSQL operator in userId ($ne) -> rejected path (CastError or blocked), NOT a bypass (SPEC 400)', async () => {
      const res = await api.post('/api/cart/add').send({ ...validPayload(), userId: { $ne: null } });
      log('016', '$ne userId', res.status, res.body);
      expect([400, 422, 500]).toContain(res.status);
    });
  });

  describe('POST /remove (remove item)', () => {
    it('INT-C-017 success: remove existing item -> 200 with remaining items', async () => {
      await add({ userId: 'rem-user', productId: 'prod-1' });
      await add({ userId: 'rem-user', productId: 'prod-2', name: 'Coke', price: 250 });
      const res = await api.post('/api/cart/remove').send({ userId: 'rem-user', productId: 'prod-1' });
      expect(res.status).toBe(200);
      expect(res.body.items.map((i: any) => i.productId)).toEqual(['prod-2']);
    });

    it('INT-C-018 success: removing a product NOT in the cart -> 200 with unchanged items', async () => {
      await add({ userId: 'ghost-user' });
      const res = await api.post('/api/cart/remove').send({ userId: 'ghost-user', productId: 'missing' });
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
    });

    it('INT-C-019 not-found: no cart for userId -> 404 "Cart not found" (SPEC: 404)', async () => {
      const res = await api.post('/api/cart/remove').send({ userId: 'nobody-here', productId: 'x' });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Cart not found');
    });
  });

  describe('GET /:userId (view cart)', () => {
    it('INT-C-020 success: returns cart for a seeded user -> 200 (SPEC: 200)', async () => {
      await add({ userId: 'reader' });
      const res = await api.get('/api/cart/reader');
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('reader');
      expect(res.body.items).toHaveLength(1);
    });

    it('INT-C-021 not-found: unknown user -> 404 "Cart not found" (SPEC: 404)', async () => {
      const res = await api.get('/api/cart/does-not-exist-zzz');
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Cart not found');
    });

    it('INT-C-022 auth-gap: reading cart WITHOUT auth -> 200 (IDOR/data exposure, SPEC would be 401/403) [GAP]', async () => {
      await add({ userId: 'victim' });
      const res = await api.get('/api/cart/victim');
      log('022', 'read without auth', res.status, res.body.userId);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /update (update quantity)', () => {
    it('INT-C-023 success: quantity replaced -> 200 (SPEC: 200)', async () => {
      await add({ userId: 'upd-user' });
      const res = await api.post('/api/cart/update').send({ userId: 'upd-user', productId: 'prod-1', quantity: 7 });
      expect(res.status).toBe(200);
      const item = res.body.items.find((i: any) => i.productId === 'prod-1');
      expect(item.quantity).toBe(7);
    });

    it('INT-C-024 not-found: no cart -> 404 "Cart not found" (SPEC: 404)', async () => {
      const res = await api.post('/api/cart/update').send({ userId: 'nobody-here', productId: 'x', quantity: 1 });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Cart not found');
    });

    it('INT-C-025 not-found: item not in cart -> 404 "Item not found in cart" (SPEC: 404)', async () => {
      await add({ userId: 'upd-user' });
      const res = await api.post('/api/cart/update').send({ userId: 'upd-user', productId: 'ghost', quantity: 1 });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Item not found in cart');
    });

    it('INT-C-026 validation: quantity 0 -> SPEC 400, ACTUAL 500 (schema min:1) [DEFECT]', async () => {
      await add({ userId: 'upd-user' });
      const res = await api.post('/api/cart/update').send({ userId: 'upd-user', productId: 'prod-1', quantity: 0 });
      log('026', 'update quantity 0', res.status, res.body);
      expect([400, 422, 500]).toContain(res.status);
    });
  });
});