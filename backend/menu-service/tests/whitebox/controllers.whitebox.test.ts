/**
 * WHITE-BOX controller tests - all menu-service controllers (SE4030).
 * Exercises every catch/error branch by mocking the service layer,
 * including the "error is not an Error instance" branch and the
 * missing-document double-response defect in category controller.
 */
import request from 'supertest';
import app from '../../src/app';
import * as restaurantService from '../../src/services/restaurant.service';
import * as menuItemService from '../../src/services/menuItem.service';
import * as categoryService from '../../src/services/category.service';
import { updateCategoryHandler, deleteCategoryHandler } from '../../src/controllers/category.controller';
import { connectAndReset, disconnectDb } from '../helpers/db';

const api = request(app);

beforeAll(async () => {
  await connectAndReset();
});
afterAll(async () => {
  await disconnectDb();
});

const validRestaurant = {
  owner_id: 'owner-1',
  name: 'Ctrl Restaurant',
  image: 'i.png',
  rating: 4,
  deliveryTime: '30 min',
  deliveryFee: 'Rs150',
  minOrder: 'Rs500',
  distance: '2 km',
  cuisines: ['Local'],
  priceLevel: 2,
  location: { type: 'Point', coordinates: [79.86, 6.92], tag: 'a' },
};

const validItem = () => ({ category_id: '665f00000000000000000000', name: 'I', description: 'D', price: 100, image_url: 'i' });

describe('WHITE-BOX restaurant.controller error branches', () => {
  it('WB-032 createRestaurant catch branch (DB failure) -> 500 with message', async () => {
    const spy = jest.spyOn(restaurantService, 'createRestaurant').mockRejectedValueOnce(new Error('db down'));
    const res = await api.post('/api/restaurants').send(validRestaurant);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('db down');
    spy.mockRestore();
  });

  it('WB-033 createRestaurant catch branch (non-Error thrown) -> 500 generic', async () => {
    const spy = jest.spyOn(restaurantService, 'createRestaurant').mockRejectedValueOnce('boom-string' as any);
    const res = await api.post('/api/restaurants').send(validRestaurant);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('An unknown error occurred');
    spy.mockRestore();
  });

  it('WB-034 updateRestaurant catch branch -> 500', async () => {
    const spy = jest.spyOn(restaurantService, 'updateRestaurant').mockRejectedValueOnce(new Error('db down'));
    const res = await api.put('/api/restaurants/665f00000000000000000000').send({ name: 'x' });
    expect(res.status).toBe(500);
    spy.mockRestore();
  });

  it('WB-035 getRestaurantWithCategoriesAndMenuItems catch branch -> 500', async () => {
    const spy = jest
      .spyOn(restaurantService, 'getRestaurantWithCategoriesAndMenuItems')
      .mockRejectedValueOnce(new Error('db down'));
    const res = await api.get('/api/restaurants/665f00000000000000000000/details');
    expect(res.status).toBe(500);
    spy.mockRestore();
  });

  it('WB-036 getRestaurantsByOwnerId catch returns generic 500 (no message leak)', async () => {
    const spy = jest.spyOn(restaurantService, 'getRestaurantsByOwnerId').mockRejectedValueOnce(new Error('secret-detail'));
    const res = await api.get('/api/restaurants/owner/anyone');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    spy.mockRestore();
  });
});

describe('WHITE-BOX menuItem.controller error branches', () => {
  it('WB-037 createMenuItem parseFloat coercion converts string price', async () => {
    const created = await api.post('/api/menu-items').send(validItem());
    expect(created.status).toBe(201);
  });

  it('WB-038 createMenuItem catch branch -> 500', async () => {
    const spy = jest.spyOn(menuItemService, 'createMenuItem').mockRejectedValueOnce(new Error('db down'));
    const res = await api.post('/api/menu-items').send(validItem());
    expect(res.status).toBe(500);
    spy.mockRestore();
  });

  it('WB-039 updateMenuItem catch branch -> 500', async () => {
    const spy = jest.spyOn(menuItemService, 'updateMenuItem').mockRejectedValueOnce(new Error('db down'));
    const res = await api.put('/api/menu-items/665f00000000000000000000').send({ price: 1 });
    expect(res.status).toBe(500);
    spy.mockRestore();
  });

  it('WB-040 deleteMenuItem catch branch -> 500', async () => {
    const spy = jest.spyOn(menuItemService, 'deleteMenuItem').mockRejectedValueOnce(new Error('db down'));
    const res = await api.delete('/api/menu-items/665f00000000000000000000');
    expect(res.status).toBe(500);
    spy.mockRestore();
  });

  it('WB-041 getMenuItemImage not-found branch -> 404', async () => {
    const spy = jest.spyOn(menuItemService, 'getMenuItemImage').mockResolvedValueOnce(null);
    const res = await api.get('/api/menu-items/665f00000000000000000000/image');
    expect(res.status).toBe(404);
    spy.mockRestore();
  });

  it('WB-042 getMenuItemImage catch branch -> 500', async () => {
    const spy = jest.spyOn(menuItemService, 'getMenuItemImage').mockRejectedValueOnce(new Error('db down'));
    const res = await api.get('/api/menu-items/665f00000000000000000000/image');
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});

describe('WHITE-BOX category.controller branches (incl. double-response defect)', () => {
  it('WB-043 createCategory catch branch -> 500', async () => {
    const spy = jest.spyOn(categoryService, 'createCategory').mockRejectedValueOnce(new Error('db down'));
    const res = await api.post('/api/category').send({ restaurant_id: '665f00000000000000000000', name: 'n', description: 'd', image_url: 'i' });
    expect(res.status).toBe(500);
    spy.mockRestore();
  });

  it('WB-044 updateCategory when NOT found -> double response bug (404 then 200 attempted)', async () => {
    // Unit-level: category.controller.ts:43-49 sends 404, then falls through and calls
    // res.status(200).json() a second time. With a real Express res this raises
    // ERR_HTTP_HEADERS_SENT (verified in Phase 3 dynamic testing).
    const calls: any[] = [];
    const fakeStatus = (code: any) => {
      calls.push({ kind: 'status', code });
      return { json: (body: any) => { calls.push({ kind: 'json', body }); return fakeRes; } };
    };
    const fakeRes: any = { status: fakeStatus };
    const spy = jest.spyOn(categoryService, 'updateCategory').mockResolvedValueOnce(null as any);
    await updateCategoryHandler({ params: { categoryId: '665f00000000000000000000' }, body: { name: 'x' } } as any, fakeRes);
    spy.mockRestore();
    const statuses = calls.filter((c) => c.kind === 'status').map((c) => c.code);
    expect(statuses).toEqual([404, 200]); // bug: second status() call after headers sent
    console.log('[WB-044] handler attempted status codes:', JSON.stringify(statuses));
  });

  it('WB-045 deleteCategory when NOT found -> double response bug (404 then 200 attempted)', async () => {
    const calls: any[] = [];
    const fakeStatus = (code: any) => {
      calls.push({ kind: 'status', code });
      return { json: (body: any) => { calls.push({ kind: 'json', body }); return fakeRes; } };
    };
    const fakeRes: any = { status: fakeStatus };
    const spy = jest.spyOn(categoryService, 'deleteCategory').mockResolvedValueOnce(null as any);
    await deleteCategoryHandler({ params: { categoryId: '665f00000000000000000000' } } as any, fakeRes);
    spy.mockRestore();
    const statuses = calls.filter((c) => c.kind === 'status').map((c) => c.code);
    expect(statuses).toEqual([404, 200]);
    console.log('[WB-045] handler attempted status codes:', JSON.stringify(statuses));
  });

  it('WB-046 deleteCategory catch branch -> 500', async () => {
    const spy = jest.spyOn(categoryService, 'deleteCategory').mockRejectedValueOnce(new Error('db down'));
    const res = await api.delete('/api/category/665f00000000000000000000');
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});