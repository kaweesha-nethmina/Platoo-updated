/**
 * BLACK-BOX functional tests - cart-service /api/cart (SE4030).
 * POST-FIX verification suite: asserts the SECURE behaviour after the fixes —
 * all endpoints require a valid HS256 token (VULN-02), identity comes from the
 * token only (IDOR fixed), price/name come from the menu/catalogue service
 * (VULN-04), quantity must be a positive integer, and error responses are
 * generic (VULN-07).
 *
 * The external menu/catalogue HTTP dependency is stubbed hermeticly with
 * jest.mock so the suite is deterministic and runs without menu-service up.
 */
import request from 'supertest';
import app from '../../src/app';
import { clearCollections, disconnectDb } from '../helpers/db';
import { validUserToken } from '../helpers/tokens';

// [Post-fix note] catalogue.service is the ONLY external HTTP boundary; it is
// mocked to return an AUTHORITATIVE price/name for any valid productId so the
// black-box suite can verify the controller trusts the server, not the client.
jest.mock('../../src/services/catalogue.service', () => ({
  getProductById: jest.fn(async (productId: string) => {
    if (typeof productId !== 'string' || !productId) return null;
    return {
      productId,
      name: 'Server-' + productId,
      price: 9999,
      image_url: 'http://localhost:3001/uploads/x.png',
    };
  }),
}));

const api = request(app);

const AUTH = (id: string) => ({ Authorization: 'Bearer ' + validUserToken(id) });

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
    it('TC-BB-055 valid item -> 200 with cart + item (price/name from server)', async () => {
      const res = await api.post('/api/cart/add').set(AUTH('user-A')).send(validPayload());
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].productId).toBe('prod-1');
      expect(res.body.items[0].price).toBe(9999); // server price, NOT client 1200
      expect(res.body.items[0].name).toBe('Server-prod-1'); // server name
    });

    it('TC-BB-056 same productId added again -> quantity increments', async () => {
      const res = await api.post('/api/cart/add').set(AUTH('user-A')).send(validPayload());
      expect(res.status).toBe(200);
      const item = res.body.items.find((i: any) => i.productId === 'prod-1');
      expect(item.quantity).toBe(4);
    });

    it('TC-BB-057 CLIENT-CONTROLLED PRICE is IGNORED -> server price stored (VULN-04 fixed)', async () => {
      const res = await api
        .post('/api/cart/add')
        .set(AUTH('user-A'))
        .send({ ...validPayload(), productId: 'prod-cheap', price: 0.01 });
      expect(res.status).toBe(200);
      const item = res.body.items.find((i: any) => i.productId === 'prod-cheap');
      expect(item.price).toBe(9999); // NOT 0.01
      console.log('[BB-057] stored price from server:', item.price);
    });

    it('TC-BB-058 NEGATIVE price is IGNORED -> server price stored', async () => {
      const res = await api
        .post('/api/cart/add')
        .set(AUTH('user-A'))
        .send({ ...validPayload(), productId: 'prod-neg', price: -100 });
      expect(res.status).toBe(200);
      const item = res.body.items.find((i: any) => i.productId === 'prod-neg');
      expect(item.price).toBe(9999);
    });

    it('TC-BB-059 quantity 0 -> 400 (positive-integer validation)', async () => {
      const res = await api.post('/api/cart/add').set(AUTH('user-A')).send({ ...validPayload(), productId: 'prod-q', quantity: 0 });
      expect(res.status).toBe(400);
    });

    it('TC-BB-060 quantity as string -> 400 (positive-integer validation)', async () => {
      const res = await api.post('/api/cart/add').set(AUTH('user-A')).send({ ...validPayload(), productId: 'prod-s', quantity: '2' });
      expect(res.status).toBe(400);
    });

    it('TC-BB-061 missing name is fine -> 200 (name now comes from the server)', async () => {
      const { name, ...payload } = validPayload();
      const res = await api.post('/api/cart/add').set(AUTH('user-A')).send({ ...payload, productId: 'prod-noname' });
      expect(res.status).toBe(200);
      const item = res.body.items.find((i: any) => i.productId === 'prod-noname');
      expect(item.name).toBe('Server-prod-noname');
    });

    it('TC-BB-062 empty body -> 400 (unknown product, fail closed)', async () => {
      const res = await api.post('/api/cart/add').set(AUTH('user-A')).send({});
      expect(res.status).toBe(400);
    });

    it('TC-BB-063 NoSQL operator in body userId ($ne) is IGNORED -> identity from token', async () => {
      const res = await api
        .post('/api/cart/add')
        .set(AUTH('no-sql-user'))
        .send({ ...validPayload(), userId: { $ne: null } });
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('no-sql-user');
    });

    it('TC-BB-064 IDOR blocked: item added to the TOKEN user cart, never to a victim', async () => {
      const res = await api
        .post('/api/cart/add')
        .set(AUTH('attacker-user'))
        .send({ ...validPayload(), userId: 'victim-user', productId: 'poison' });
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('attacker-user'); // NOT victim-user
      expect(res.body.items.some((i: any) => i.productId === 'poison')).toBe(true);
    });
  });

  describe('POST /remove', () => {
    it('TC-BB-065 remove existing item -> 200', async () => {
      await api.post('/api/cart/add').set(AUTH('remove-user')).send({ ...validPayload(), productId: 'prod-1' });
      const res = await api.post('/api/cart/remove').set(AUTH('remove-user')).send({ productId: 'prod-1' });
      expect(res.status).toBe(200);
      expect(res.body.items.filter((i: any) => i.productId === 'prod-1')).toEqual([]);
    });

    it('TC-BB-066 remove from non-existent cart -> 404', async () => {
      const res = await api.post('/api/cart/remove').set(AUTH('nobody')).send({ productId: 'x' });
      expect(res.status).toBe(404);
    });

    it('TC-BB-067 remove non-existent product -> 200 (no error)', async () => {
      await api.post('/api/cart/add').set(AUTH('user-B')).send(validPayload());
      const res = await api.post('/api/cart/remove').set(AUTH('user-B')).send({ productId: 'missing-item' });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /:userId', () => {
    it('TC-BB-068 returns cart for the token user -> 200', async () => {
      await api.post('/api/cart/add').set(AUTH('reader-user')).send(validPayload());
      const res = await api.get('/api/cart/reader-user').set(AUTH('reader-user'));
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('reader-user');
    });

    it('TC-BB-069 IDOR blocked: cannot read a VICTIM cart with attacker token -> 404', async () => {
      const res = await api.get('/api/cart/victim-user').set(AUTH('attacker-reader'));
      expect(res.status).toBe(404);
      expect(res.body.userId).toBeUndefined();
    });

    it('TC-BB-070 non-existent user (token identity) -> 404', async () => {
      const res = await api.get('/api/cart/no-such-user-zzz').set(AUTH('no-such-user-zzz'));
      expect(res.status).toBe(404);
    });
  });

  describe('POST /update', () => {
    it('TC-BB-071 update quantity -> 200', async () => {
      await api.post('/api/cart/add').set(AUTH('user-A')).send({ ...validPayload(), productId: 'upd-prod' });
      const res = await api.post('/api/cart/update').set(AUTH('user-A')).send({ userId: 'user-A', productId: 'upd-prod', quantity: 7 });
      expect(res.status).toBe(200);
      const item = res.body.items.find((i: any) => i.productId === 'upd-prod');
      expect(item.quantity).toBe(7);
    });

    it('TC-BB-072 update non-existent cart -> 404', async () => {
      const res = await api.post('/api/cart/update').set(AUTH('nobody')).send({ productId: 'x', quantity: 1 });
      expect(res.status).toBe(404);
    });

    it('TC-BB-073 update non-existent product -> 404', async () => {
      await api.post('/api/cart/add').set(AUTH('ghost-user')).send({ ...validPayload(), productId: 'real-prod' });
      const res = await api.post('/api/cart/update').set(AUTH('ghost-user')).send({ productId: 'ghost', quantity: 1 });
      expect(res.status).toBe(404);
    });

    it('TC-BB-074 update quantity to 0 -> 400 (positive-integer validation)', async () => {
      await api.post('/api/cart/add').set(AUTH('user-A')).send({ ...validPayload(), productId: 'zupd' });
      const res = await api.post('/api/cart/update').set(AUTH('user-A')).send({ productId: 'zupd', quantity: 0 });
      expect(res.status).toBe(400);
    });
  });

  describe('Authentication / Broken Access Control', () => {
    it('TC-BB-075 all cart endpoints require a token -> 401 without Authorization', async () => {
      const res = await api.post('/api/cart/add').send(validPayload()).set('Authorization', '');
      expect(res.status).toBe(401);
    });

    it('TC-BB-076 garbage JWT rejected -> 401', async () => {
      const res = await api
        .post('/api/cart/add')
        .send(validPayload())
        .set('Authorization', 'Bearer not-a-real-token.asdf.ghjk');
      expect(res.status).toBe(401);
    });

    it('TC-BB-077 expired / alg:none token rejected -> 401', async () => {
      const res = await api
        .post('/api/cart/add')
        .send(validPayload())
        .set('Authorization', 'Bearer eyJhbGciOiJub25lIn0.eyJleHAiOjF9.');
      expect(res.status).toBe(401);
    });
  });
});