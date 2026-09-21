/**
 * BLACK-BOX functional tests - cart-service /api/cart (SE4030).
 * Treats the API as a black-box spec (no internal knowledge).
 * Expectation = spec-correct behaviour; failing tests document defects.
 */
import request from 'supertest';
import app from '../../src/app';
import { clearCollections, disconnectDb } from '../helpers/db';

const api = request(app);

beforeAll(async () => {
  await clearCollections();
});

afterAll(async () => {
  await disconnectDb();
});

const validPayload = () => ({
  userId: 'user-A',
  productId: 'prod-1',
  name: 'Margherita Pizza',
  price: 1200,
  quantity: 2,
  image: 'http://localhost:3001/uploads/margherita.png',
});

describe('BLACK-BOX /api/cart', () => {
  describe('POST /add', () => {
    it('TC-BB-055 valid item -> 200 with cart + item', async () => {
      const res = await api.post('/api/cart/add').send(validPayload());
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].productId).toBe('prod-1');
    });

    it('TC-BB-056 same productId added again -> quantity increments', async () => {
      const res = await api.post('/api/cart/add').send(validPayload());
      expect(res.status).toBe(200);
      const item = res.body.items.find((i: any) => i.productId === 'prod-1');
      expect(item.quantity).toBe(4);
    });

    it('TC-BB-057 CLIENT-CONTROLLED PRICE is stored verbatim (price tampering)', async () => {
      const res = await api.post('/api/cart/add').send({ ...validPayload(), productId: 'prod-cheap', price: 0.01 });
      expect(res.status).toBe(200);
      const item = res.body.items.find((i: any) => i.productId === 'prod-cheap');
      expect(item.price).toBe(0.01);
      console.log('[BB-057] stored client price:', item.price);
    });

    it('TC-BB-058 NEGATIVE price accepted', async () => {
      const res = await api.post('/api/cart/add').send({ ...validPayload(), productId: 'prod-neg', price: -100 });
      console.log('[BB-058] negative price returned:', res.status, JSON.stringify(res.body.items.slice(-1)).slice(0, 200));
      expect(res.status).toBe(200);
    });

    it('TC-BB-059 quantity 0 or negative -> expect 400/422 (defect: mongoose min:1 -> 500)', async () => {
      const res = await api.post('/api/cart/add').send({ ...validPayload(), productId: 'prod-q', quantity: 0 });
      console.log('[BB-059] quantity 0 returned:', res.status, JSON.stringify(res.body).slice(0, 250));
      expect([400, 422]).toContain(res.status);
    });

    it('TC-BB-060 quantity as string -> expect 400/422 (defect: CastError 500)', async () => {
      const res = await api.post('/api/cart/add').send({ ...validPayload(), productId: 'prod-s', quantity: '2' });
      console.log('[BB-060] string quantity returned:', res.status, JSON.stringify(res.body).slice(0, 250));
      expect([400, 422]).toContain(res.status);
    });

    it('TC-BB-061 missing required field (name) -> expect 400 (defect: 500)', async () => {
      const { name, ...payload } = validPayload();
      const res = await api.post('/api/cart/add').send(payload);
      console.log('[BB-061] missing name returned:', res.status, JSON.stringify(res.body).slice(0, 250));
      expect([400, 422]).toContain(res.status);
    });

    it('TC-BB-062 empty body -> expect 400 (defect: 500)', async () => {
      const res = await api.post('/api/cart/add').send({});
      console.log('[BB-062] empty body returned:', res.status, JSON.stringify(res.body).slice(0, 250));
      expect([400, 422]).toContain(res.status);
    });

    it('TC-BB-063 NoSQL operator in userId ($ne) -> expect rejection (cast to 500 or blocked)', async () => {
      const res = await api.post('/api/cart/add').send({ ...validPayload(), userId: { $ne: null } });
      console.log('[BB-063] $ne userId returned:', res.status, JSON.stringify(res.body).slice(0, 300));
      expect([400, 422, 500]).toContain(res.status);
    });

    it('TC-BB-064 IDOR: adding an item to ANOTHER users cart succeeds with no auth', async () => {
      const res = await api.post('/api/cart/add').send({ ...validPayload(), userId: 'victim-user', productId: 'poison' });
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('victim-user');
      expect(res.body.items.some((i: any) => i.productId === 'poison')).toBe(true);
      console.log('[BB-064] attacker poisoned victim cart:', JSON.stringify(res.body).slice(0, 250));
    });
  });

  describe('POST /remove', () => {
    it('TC-BB-065 remove existing item -> 200', async () => {
      await api.post('/api/cart/add').send({ ...validPayload(), userId: 'remove-user', productId: 'prod-1' });
      const res = await api.post('/api/cart/remove').send({ userId: 'remove-user', productId: 'prod-1' });
      expect(res.status).toBe(200);
      expect(res.body.items.filter((i: any) => i.productId === 'prod-1')).toEqual([]);
    });

    it('TC-BB-066 remove from non-existent cart -> 404', async () => {
      const res = await api.post('/api/cart/remove').send({ userId: 'nobody', productId: 'x' });
      expect(res.status).toBe(404);
    });

    it('TC-BB-067 remove non-existent product -> 200 (no error)', async () => {
      await api.post('/api/cart/add').send({ ...validPayload(), userId: 'user-B' });
      const res = await api.post('/api/cart/remove').send({ userId: 'user-B', productId: 'missing-item' });
      console.log('[BB-067] remove missing item returned:', res.status);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /:userId', () => {
    it('TC-BB-068 returns cart for valid user -> 200', async () => {
      await api.post('/api/cart/add').send({ ...validPayload(), userId: 'reader-user' });
      const res = await api.get('/api/cart/reader-user');
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('reader-user');
    });

    it('TC-BB-069 IDOR: reading another users cart without auth -> 200 (data exposure)', async () => {
      const res = await api.get('/api/cart/victim-user');
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('victim-user');
      console.log('[BB-069] unauthenticated read of victim cart:', JSON.stringify(res.body).slice(0, 300));
    });

    it('TC-BB-070 non-existent user -> 404', async () => {
      const res = await api.get('/api/cart/no-such-user-zzz');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /update', () => {
    it('TC-BB-071 update quantity -> 200', async () => {
      await api.post('/api/cart/add').send({ ...validPayload(), productId: 'upd-prod' });
      const res = await api.post('/api/cart/update').send({ userId: 'user-A', productId: 'upd-prod', quantity: 7 });
      expect(res.status).toBe(200);
      const item = res.body.items.find((i: any) => i.productId === 'upd-prod');
      expect(item.quantity).toBe(7);
    });

    it('TC-BB-072 update non-existent cart -> 404', async () => {
      const res = await api.post('/api/cart/update').send({ userId: 'nobody', productId: 'x', quantity: 1 });
      expect(res.status).toBe(404);
    });

    it('TC-BB-073 update non-existent product -> 404', async () => {
      const res = await api.post('/api/cart/update').send({ userId: 'user-A', productId: 'ghost', quantity: 1 });
      expect(res.status).toBe(404);
    });

    it('TC-BB-074 update quantity to 0 -> expect 4xx (defect: validation error -> 500)', async () => {
      await api.post('/api/cart/add').send({ ...validPayload(), productId: 'zupd' });
      const res = await api.post('/api/cart/update').send({ userId: 'user-A', productId: 'zupd', quantity: 0 });
      console.log('[BB-074] quantity=0 update returned:', res.status, JSON.stringify(res.body).slice(0, 250));
      expect([400, 422]).toContain(res.status);
    });
  });

  describe('Authentication / Broken Access Control', () => {
    it('TC-BB-075 all cart endpoints work with NO Authorization header at all', async () => {
      const res = await api
        .post('/api/cart/add')
        .send(validPayload())
        .set('Authorization', '');
      expect(res.status).toBe(200);
    });

    it('TC-BB-076 garbage JWT accepted (never verified)', async () => {
      const res = await api
        .post('/api/cart/add')
        .send({ ...validPayload(), userId: 'noauth-user' })
        .set('Authorization', 'Bearer not-a-real-token.asdf.ghjk');
      console.log('[BB-076] garbage token accepted:', res.status);
      expect(res.status).toBe(200);
    });

    it('TC-BB-077 expired/unsigned token accepted', async () => {
      const res = await api
        .post('/api/cart/add')
        .send({ ...validPayload(), userId: 'expired-user' })
        .set('Authorization', 'Bearer eyJhbGciOiJub25lIn0.eyJleHAiOjF9.');
      console.log('[BB-077] no-alg expired token accepted:', res.status);
      expect(res.status).toBe(200);
    });
  });
});