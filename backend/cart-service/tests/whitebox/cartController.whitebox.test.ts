/**
 * WHITE-BOX tests - cartController.ts (SE4030). Covers all branches:
 *  - addItemToCart: new cart / existing item / new item / save failure
 *  - removeItemFromCart: no cart 404 / removed / save failure
 *  - getCartByUserId: found 200 / missing 404 / db failure 500
 *  - updateCartItemQuantity: no cart 404 / no item 404 / success / failures
 */
import request from 'supertest';
import app from '../../src/app';
import { CartModel } from '../../src/models/cartModel';
import { clearCollections, disconnectDb } from '../helpers/db';

const api = request(app);

beforeAll(async () => {
  await clearCollections();
});
afterAll(async () => {
  await disconnectDb();
});

describe('WHITE-BOX POST /api/cart/add', () => {
  it('WB-054 new cart created when none exists', async () => {
    const res = await api.post('/api/cart/add').send({ userId: 'w-new', productId: 'p1', name: 'n', price: 10, quantity: 1 });
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('w-new');
    expect(res.body.items.length).toBe(1);
  });

  it('WB-055 existing cart: existing item quantity incremented', async () => {
    await api.post('/api/cart/add').send({ userId: 'w-inc', productId: 'p1', name: 'n', price: 10, quantity: 2 });
    const res = await api.post('/api/cart/add').send({ userId: 'w-inc', productId: 'p1', name: 'n', price: 10, quantity: 3 });
    const item = res.body.items.find((i: any) => i.productId === 'p1');
    expect(item.quantity).toBe(5);
  });

  it('WB-056 existing cart: new product pushes line item', async () => {
    await api.post('/api/cart/add').send({ userId: 'w-push', productId: 'a', name: 'n', price: 1, quantity: 1 });
    const res = await api.post('/api/cart/add').send({ userId: 'w-push', productId: 'b', name: 'n2', price: 2, quantity: 1 });
    expect(res.body.items.length).toBe(2);
  });

  it('WB-057 save() failure -> 500 with error object echoed', async () => {
    const spy = jest.spyOn(CartModel.prototype, 'save').mockRejectedValueOnce(new Error('db down'));
    const res = await api.post('/api/cart/add').send({ userId: 'w-err', productId: 'p1', name: 'n', price: 1, quantity: 1 });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error adding item to cart');
    spy.mockRestore();
  });
});

describe('WHITE-BOX POST /api/cart/remove', () => {
  it('WB-058 cart not found -> 404', async () => {
    const res = await api.post('/api/cart/remove').send({ userId: 'w-missing', productId: 'x' });
    expect(res.status).toBe(404);
  });

  it('WB-059 item removed -> 200', async () => {
    await api.post('/api/cart/add').send({ userId: 'w-rm', productId: 'doomed', name: 'n', price: 1, quantity: 1 });
    const res = await api.post('/api/cart/remove').send({ userId: 'w-rm', productId: 'doomed' });
    expect(res.status).toBe(200);
    expect(res.body.items.filter((i: any) => i.productId === 'doomed')).toEqual([]);
  });

  it('WB-060 save() failure -> 500', async () => {
    await api.post('/api/cart/add').send({ userId: 'w-rm-err', productId: 'x', name: 'n', price: 1, quantity: 1 });
    const spy = jest.spyOn(CartModel.prototype, 'save').mockRejectedValueOnce(new Error('db down'));
    const res = await api.post('/api/cart/remove').send({ userId: 'w-rm-err', productId: 'x' });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error removing item from cart');
    spy.mockRestore();
  });
});

describe('WHITE-BOX GET /api/cart/:userId', () => {
  it('WB-061 found -> 200', async () => {
    await api.post('/api/cart/add').send({ userId: 'w-get', productId: 'p', name: 'n', price: 1, quantity: 1 });
    const res = await api.get('/api/cart/w-get');
    expect(res.status).toBe(200);
  });

  it('WB-062 missing -> 404', async () => {
    const res = await api.get('/api/cart/w-no-such');
    expect(res.status).toBe(404);
  });

  it('WB-063 findOne failure -> 500 (logs error, echoes object)', async () => {
    const spy = jest.spyOn(CartModel, 'findOne').mockRejectedValueOnce(new Error('db down'));
    const res = await api.get('/api/cart/w-err');
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error fetching cart');
    spy.mockRestore();
  });
});

describe('WHITE-BOX POST /api/cart/update', () => {
  it('WB-064 cart not found -> 404', async () => {
    const res = await api.post('/api/cart/update').send({ userId: 'w-none', productId: 'x', quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('WB-065 item not found -> 404', async () => {
    await api.post('/api/cart/add').send({ userId: 'w-up', productId: 'a', name: 'n', price: 1, quantity: 1 });
    const res = await api.post('/api/cart/update').send({ userId: 'w-up', productId: 'ghost', quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('WB-066 update success -> 200', async () => {
    await api.post('/api/cart/add').send({ userId: 'w-up2', productId: 'a', name: 'n', price: 1, quantity: 1 });
    const res = await api.post('/api/cart/update').send({ userId: 'w-up2', productId: 'a', quantity: 9 });
    expect(res.status).toBe(200);
    const item = res.body.items.find((i: any) => i.productId === 'a');
    expect(item.quantity).toBe(9);
  });

  it('WB-067 save failure -> 500', async () => {
    await api.post('/api/cart/add').send({ userId: 'w-up-err', productId: 'a', name: 'n', price: 1, quantity: 1 });
    const spy = jest.spyOn(CartModel.prototype, 'save').mockRejectedValueOnce(new Error('db down'));
    const res = await api.post('/api/cart/update').send({ userId: 'w-up-err', productId: 'a', quantity: 2 });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error updating cart item quantity');
    spy.mockRestore();
  });

  it('WB-068 findOne failure -> 500', async () => {
    const spy = jest.spyOn(CartModel, 'findOne').mockRejectedValueOnce(new Error('db down'));
    const res = await api.post('/api/cart/update').send({ userId: 'any', productId: 'a', quantity: 1 });
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});

describe('WHITE-BOX model validation (cartModel.ts)', () => {
  it('WB-069 mongoose enforces required + min:1 on item.quantity', async () => {
    const res = await api.post('/api/cart/add').send({ userId: 'w-qty0', productId: 'p', name: 'n', price: 1, quantity: 0 });
    console.log('[WB-069] quantity=0 ->', res.status, JSON.stringify(res.body).slice(0, 250));
    expect(res.status).toBe(500); // defect: validation error leaks as 500
  });

  it('WB-070 price field has NO minimum (negative stored)', async () => {
    const res = await api.post('/api/cart/add').send({ userId: 'w-neg', productId: 'p', name: 'n', price: -999, quantity: 1 });
    expect(res.status).toBe(200);
    const item = res.body.items.find((i: any) => i.productId === 'p');
    expect(item.price).toBe(-999);
    console.log('[WB-070] stored negative price:', item.price);
  });
});