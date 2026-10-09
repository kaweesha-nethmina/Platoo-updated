/**
 * WHITE-BOX tests - cartController.ts (SE4030). POST-FIX verification.
 * Covers all branches with the catalogue HTTP boundary mocked:
 *  - addItemToCart: new cart / existing item / new item / save failure
 *  - removeItemFromCart: no cart 404 / removed / save failure
 *  - getCartByUserId: found 200 / missing 404 / db failure 500
 *  - updateCartItemQuantity: no cart 404 / no item 404 / success / failures
 * All endpoints require a valid token (VULN-02); server price is used (VULN-04).
 */
import request from 'supertest';
import app from '../../src/app';
import { CartModel } from '../../src/models/cartModel';
import { clearCollections, disconnectDb } from '../helpers/db';
import { validUserToken } from '../helpers/tokens';

jest.mock('../../src/services/catalogue.service', () => ({
  getProductById: jest.fn(async (productId: string) => {
    if (typeof productId !== 'string' || !productId) return null;
    return { productId, name: 'Server-' + productId, price: 9999, image_url: 'http://localhost:3001/uploads/x.png' };
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

describe('WHITE-BOX POST /api/cart/add', () => {
  it('WB-054 new cart created when none exists', async () => {
    const res = await api.post('/api/cart/add').set(AUTH('w-new')).send({ productId: 'p1', quantity: 1 });
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('w-new');
    expect(res.body.items.length).toBe(1);
  });

  it('WB-055 existing cart: existing item quantity incremented', async () => {
    await api.post('/api/cart/add').set(AUTH('w-inc')).send({ productId: 'p1', quantity: 2 });
    const res = await api.post('/api/cart/add').set(AUTH('w-inc')).send({ productId: 'p1', quantity: 3 });
    const item = res.body.items.find((i: any) => i.productId === 'p1');
    expect(item.quantity).toBe(5);
  });

  it('WB-056 existing cart: new product pushes line item', async () => {
    await api.post('/api/cart/add').set(AUTH('w-push')).send({ productId: 'a', quantity: 1 });
    const res = await api.post('/api/cart/add').set(AUTH('w-push')).send({ productId: 'b', quantity: 1 });
    expect(res.body.items.length).toBe(2);
  });

  it('WB-057 save() failure -> 500 with generic message (no error-object leak)', async () => {
    const spy = jest.spyOn(CartModel.prototype, 'save').mockRejectedValueOnce(new Error('db down'));
    const res = await api.post('/api/cart/add').set(AUTH('w-err')).send({ productId: 'p1', quantity: 1 });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error adding item to cart');
    expect(res.body.error).toBeUndefined();
    spy.mockRestore();
  });
});

describe('WHITE-BOX POST /api/cart/remove', () => {
  it('WB-058 cart not found -> 404', async () => {
    const res = await api.post('/api/cart/remove').set(AUTH('w-missing')).send({ productId: 'x' });
    expect(res.status).toBe(404);
  });

  it('WB-059 item removed -> 200', async () => {
    await api.post('/api/cart/add').set(AUTH('w-rm')).send({ productId: 'doomed', quantity: 1 });
    const res = await api.post('/api/cart/remove').set(AUTH('w-rm')).send({ productId: 'doomed' });
    expect(res.status).toBe(200);
    expect(res.body.items.filter((i: any) => i.productId === 'doomed')).toEqual([]);
  });

  it('WB-060 save() failure -> 500 with generic message', async () => {
    await api.post('/api/cart/add').set(AUTH('w-rm-err')).send({ productId: 'x', quantity: 1 });
    const spy = jest.spyOn(CartModel.prototype, 'save').mockRejectedValueOnce(new Error('db down'));
    const res = await api.post('/api/cart/remove').set(AUTH('w-rm-err')).send({ productId: 'x' });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error removing item from cart');
    expect(res.body.error).toBeUndefined();
    spy.mockRestore();
  });
});

describe('WHITE-BOX GET /api/cart/:userId', () => {
  it('WB-061 found -> 200', async () => {
    await api.post('/api/cart/add').set(AUTH('w-get')).send({ productId: 'p', quantity: 1 });
    const res = await api.get('/api/cart/w-get').set(AUTH('w-get'));
    expect(res.status).toBe(200);
  });

  it('WB-062 missing -> 404', async () => {
    const res = await api.get('/api/cart/w-no-such').set(AUTH('w-no-such'));
    expect(res.status).toBe(404);
  });

  it('WB-063 findOne failure -> 500 with generic message', async () => {
    const spy = jest.spyOn(CartModel, 'findOne').mockRejectedValueOnce(new Error('db down'));
    const res = await api.get('/api/cart/w-err').set(AUTH('w-err'));
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error fetching cart');
    spy.mockRestore();
  });
});

describe('WHITE-BOX POST /api/cart/update', () => {
  it('WB-064 cart not found -> 404', async () => {
    const res = await api.post('/api/cart/update').set(AUTH('w-none')).send({ productId: 'x', quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('WB-065 item not found -> 404', async () => {
    await api.post('/api/cart/add').set(AUTH('w-up')).send({ productId: 'a', quantity: 1 });
    const res = await api.post('/api/cart/update').set(AUTH('w-up')).send({ productId: 'ghost', quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('WB-066 update success -> 200', async () => {
    await api.post('/api/cart/add').set(AUTH('w-up2')).send({ productId: 'a', quantity: 1 });
    const res = await api.post('/api/cart/update').set(AUTH('w-up2')).send({ productId: 'a', quantity: 9 });
    expect(res.status).toBe(200);
    const item = res.body.items.find((i: any) => i.productId === 'a');
    expect(item.quantity).toBe(9);
  });

  it('WB-067 save failure -> 500 with generic message', async () => {
    await api.post('/api/cart/add').set(AUTH('w-up-err')).send({ productId: 'a', quantity: 1 });
    const spy = jest.spyOn(CartModel.prototype, 'save').mockRejectedValueOnce(new Error('db down'));
    const res = await api.post('/api/cart/update').set(AUTH('w-up-err')).send({ productId: 'a', quantity: 2 });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error updating cart item quantity');
    spy.mockRestore();
  });

  it('WB-068 findOne failure -> 500', async () => {
    const spy = jest.spyOn(CartModel, 'findOne').mockRejectedValueOnce(new Error('db down'));
    const res = await api.post('/api/cart/update').set(AUTH('any')).send({ productId: 'a', quantity: 1 });
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});

describe('WHITE-BOX model / controller validation (post-fix)', () => {
  it('WB-069 quantity 0 -> 400 (controller positive-integer validation)', async () => {
    const res = await api.post('/api/cart/add').set(AUTH('w-qty0')).send({ productId: 'p', quantity: 0 });
    expect(res.status).toBe(400);
  });

  it('WB-070 negative price is IGNORED -> server price stored (VULN-04 fixed)', async () => {
    const res = await api.post('/api/cart/add').set(AUTH('w-neg')).send({ productId: 'p', price: -999, quantity: 1 });
    expect(res.status).toBe(200);
    const item = res.body.items.find((i: any) => i.productId === 'p');
    expect(item.price).toBe(9999); // server price, NOT -999
  });
});