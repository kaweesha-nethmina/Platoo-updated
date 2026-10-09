/**
 * UNIT tests - menu-service menuItem.controller.ts (SE4030 / SSD).
 * Services are mocked; no DB, no network. Focus on price coercion,
 * response wiring, and the DELETE-404 defect.
 */
import {
  createMenuItemHandler,
  getMenuItemsByCategoryHandler,
  updateMenuItemHandler,
  deleteMenuItemHandler,
  getMenuItemsByRestaurantHandler,
  getAllMenuItemsHandler,
  getMenuItemImageHandler,
} from '../../../src/controllers/menuItem.controller';
import * as menuItemService from '../../../src/services/menuItem.service';

jest.mock('../../../src/services/menuItem.service', () => ({
  createMenuItem: jest.fn(),
  getMenuItemsByCategory: jest.fn(),
  updateMenuItem: jest.fn(),
  deleteMenuItem: jest.fn(),
  getMenuItemsByRestaurant: jest.fn(),
  getAllMenuItems: jest.fn(),
  getMenuItemImage: jest.fn(),
}));

const svc = menuItemService as jest.Mocked<typeof menuItemService>;

const mockRes = () =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }) as any;

const req = (body: any = {}, params: any = {}) => ({ body, params }) as any;

const validItem = {
  category_id: 'c1',
  name: 'Margherita',
  description: 'Classic',
  price: 1200,
  image_url: 'http://x/m.png',
  is_veg: true,
  is_available: true,
};

describe('menuItem.controller createMenuItemHandler (POST /api/menu-items)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-MC-001 numeric price stays numeric → 201', async () => {
    svc.createMenuItem.mockImplementation((d: any) => Promise.resolve(d) as any);
    const res = mockRes();
    const body = { ...validItem, price: 1200 };
    await createMenuItemHandler(req(body), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect((res.json.mock.calls[0][0] as any).price).toBe(1200);
  });

  it('UNIT-M-MC-002 price as numeric string "12.55" → parseFloat coerced to 12.55', async () => {
    svc.createMenuItem.mockImplementation((d: any) => Promise.resolve(d) as any);
    const res = mockRes();
    await createMenuItemHandler(req({ ...validItem, price: '12.55' }), res);
    expect((res.json.mock.calls[0][0] as any).price).toBe(12.55);
  });

  it('UNIT-M-MC-003 price as strings "12px" / "abc" → parseFloat result (12 / NaN) passes through', async () => {
    svc.createMenuItem.mockImplementation((d: any) => Promise.resolve(d) as any);
    const res1 = mockRes();
    await createMenuItemHandler(req({ ...validItem, price: '12px' }), res1);
    expect((res1.json.mock.calls[0][0] as any).price).toBe(12);

    const res2 = mockRes();
    await createMenuItemHandler(req({ ...validItem, price: 'abc' }), res2);
    expect(Number.isNaN((res2.json.mock.calls[0][0] as any).price)).toBe(true);
  });

  it('UNIT-M-MC-004 price 0 or missing → coercion skipped (falsy guard), price stays 0/undefined', async () => {
    svc.createMenuItem.mockImplementation((d: any) => Promise.resolve(d) as any);

    const resZero = mockRes();
    await createMenuItemHandler(req({ ...validItem, price: 0 }), resZero);
    expect((resZero.json.mock.calls[0][0] as any).price).toBe(0);

    const { price, ...noPrice } = validItem;
    const resMissing = mockRes();
    await createMenuItemHandler(req(noPrice), resMissing);
    expect((resMissing.json.mock.calls[0][0] as any).price).toBeUndefined();
  });

  it('UNIT-M-MC-005 boundary: huge price (1e15) passes through untouched', async () => {
    svc.createMenuItem.mockImplementation((d: any) => Promise.resolve(d) as any);
    const res = mockRes();
    await createMenuItemHandler(req({ ...validItem, price: 1e15 }), res);
    expect((res.json.mock.calls[0][0] as any).price).toBe(1e15);
  });

  it('UNIT-M-MC-006 service error → 500 with message', async () => {
    svc.createMenuItem.mockRejectedValue(new Error('Path `price` is required.'));
    const res = mockRes();
    await createMenuItemHandler(req({}), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Path `price` is required.' });
  });

  it('UNIT-M-MC-007 non-Error throw → 500 "An unknown error occurred"', async () => {
    svc.createMenuItem.mockRejectedValue('oops');
    const res = mockRes();
    await createMenuItemHandler(req({}), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });
});

describe('menuItem.controller getMenuItemsByCategoryHandler (GET /category/:categoryId)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-MC-008 success → 200 array', async () => {
    svc.getMenuItemsByCategory.mockResolvedValue([{ _id: 'm1' }] as any);
    const res = mockRes();
    await getMenuItemsByCategoryHandler(req({}, { categoryId: 'c1' }), res);
    expect(svc.getMenuItemsByCategory).toHaveBeenCalledWith('c1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('UNIT-M-MC-009 failure → 500', async () => {
    svc.getMenuItemsByCategory.mockRejectedValue(new Error('rk'));
    const res = mockRes();
    await getMenuItemsByCategoryHandler(req({}, { categoryId: 'c1' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('menuItem.controller updateMenuItemHandler (PUT /:menuItemId)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-MC-010 success → 200, price coerced from string', async () => {
    svc.updateMenuItem.mockImplementation((id: any, d: any) => Promise.resolve({ ...d, _id: id }) as any);
    const res = mockRes();
    await updateMenuItemHandler(req({ price: '99.5', name: 'New' }, { menuItemId: 'm1' }), res);
    expect(svc.updateMenuItem).toHaveBeenCalledWith('m1', { price: 99.5, name: 'New' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect((res.json.mock.calls[0][0] as any).price).toBe(99.5);
  });

  it('UNIT-M-MC-011 not found → 404 "Menu item not found"', async () => {
    svc.updateMenuItem.mockResolvedValue(null as any);
    const res = mockRes();
    await updateMenuItemHandler(req({ name: 'x' }, { menuItemId: 'nope' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('UNIT-M-MC-029 numeric price on update stays numeric (typeof number branch)', async () => {
    svc.updateMenuItem.mockImplementation((id: any, d: any) => Promise.resolve({ ...d, _id: id }) as any);
    const res = mockRes();
    await updateMenuItemHandler(req({ price: 42, name: 'Num' }, { menuItemId: 'm1' }), res);
    expect(svc.updateMenuItem).toHaveBeenCalledWith('m1', { price: 42, name: 'Num' });
    expect((res.json.mock.calls[0][0] as any).price).toBe(42);
  });

  it('UNIT-M-MC-012 error → 500', async () => {
    svc.updateMenuItem.mockRejectedValue(new Error('CastError'));
    const res = mockRes();
    await updateMenuItemHandler(req({}, { menuItemId: 'bad' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('menuItem.controller deleteMenuItemHandler (DELETE /:menuItemId)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-MC-013 deleted → 200 "Menu item deleted successfully"', async () => {
    svc.deleteMenuItem.mockResolvedValue({ _id: 'm1' } as any);
    const res = mockRes();
    await deleteMenuItemHandler(req({}, { menuItemId: 'm1' }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Menu item deleted successfully' });
  });

  it('UNIT-M-MC-014 DEFECT: not found → 404 sent first, then 200 overrides it', async () => {
    svc.deleteMenuItem.mockResolvedValue(null as any);
    const res = mockRes();
    await deleteMenuItemHandler(req({}, { menuItemId: 'nope' }), res);
    // handler calls status(404) then falls through to status(200).json(message)
    expect(res.status).toHaveBeenNthCalledWith(1, 404);
    expect(res.json).toHaveBeenNthCalledWith(1, { error: 'Menu item not found' });
    expect(res.status).toHaveBeenNthCalledWith(2, 200);
    expect(res.json).toHaveBeenNthCalledWith(2, { message: 'Menu item deleted successfully' });
  });

  it('UNIT-M-MC-015 error → 500', async () => {
    svc.deleteMenuItem.mockRejectedValue(new Error('db'));
    const res = mockRes();
    await deleteMenuItemHandler(req({}, { menuItemId: 'm1' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('menuItem.controller getMenuItemsByRestaurantHandler (GET /restaurant/:restaurantId)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-MC-016 success → 200 array', async () => {
    svc.getMenuItemsByRestaurant.mockResolvedValue([{ _id: 'm1' }] as any);
    const res = mockRes();
    await getMenuItemsByRestaurantHandler(req({}, { restaurantId: 'r1' }), res);
    expect(svc.getMenuItemsByRestaurant).toHaveBeenCalledWith('r1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('UNIT-M-MC-017 failure → 500', async () => {
    svc.getMenuItemsByRestaurant.mockRejectedValue(new Error('db'));
    const res = mockRes();
    await getMenuItemsByRestaurantHandler(req({}, { restaurantId: 'r1' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('menuItem.controller getAllMenuItemsHandler (GET /api/menu-items)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-MC-018 success → 200 array', async () => {
    svc.getAllMenuItems.mockResolvedValue([] as any);
    const res = mockRes();
    await getAllMenuItemsHandler(req(), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('UNIT-M-MC-019 failure → 500', async () => {
    svc.getAllMenuItems.mockRejectedValue(new Error('db'));
    const res = mockRes();
    await getAllMenuItemsHandler(req(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('menuItem.controller getMenuItemImageHandler (GET /:menuItemId/image)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-MC-020 found → 200 { image_url }', async () => {
    svc.getMenuItemImage.mockResolvedValue({ image_url: 'http://x/m.png' } as any);
    const res = mockRes();
    await getMenuItemImageHandler(req({}, { menuItemId: 'm1' }), res);
    expect(svc.getMenuItemImage).toHaveBeenCalledWith('m1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ image_url: 'http://x/m.png' });
  });

  it('UNIT-M-MC-021 not found → 404 "Menu item or image not found"', async () => {
    svc.getMenuItemImage.mockResolvedValue(null as any);
    const res = mockRes();
    await getMenuItemImageHandler(req({}, { menuItemId: 'nope' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Menu item or image not found' });
  });

  it('UNIT-M-MC-022 error → 500', async () => {
    svc.getMenuItemImage.mockRejectedValue(new Error('CastError'));
    const res = mockRes();
    await getMenuItemImageHandler(req({}, { menuItemId: 'bad' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('menuItem.controller non-Error throw → 500 "An unknown error occurred" (catch-all branches)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-MC-023 getMenuItemsByCategoryHandler', async () => {
    svc.getMenuItemsByCategory.mockRejectedValue('s');
    const res = mockRes();
    await getMenuItemsByCategoryHandler(req({}, { categoryId: 'c1' }), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });

  it('UNIT-M-MC-024 updateMenuItemHandler', async () => {
    svc.updateMenuItem.mockRejectedValue('s');
    const res = mockRes();
    await updateMenuItemHandler(req({}, { menuItemId: 'm1' }), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });

  it('UNIT-M-MC-025 deleteMenuItemHandler', async () => {
    svc.deleteMenuItem.mockRejectedValue('s');
    const res = mockRes();
    await deleteMenuItemHandler(req({}, { menuItemId: 'm1' }), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });

  it('UNIT-M-MC-026 getMenuItemsByRestaurantHandler', async () => {
    svc.getMenuItemsByRestaurant.mockRejectedValue('s');
    const res = mockRes();
    await getMenuItemsByRestaurantHandler(req({}, { restaurantId: 'r1' }), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });

  it('UNIT-M-MC-027 getAllMenuItemsHandler', async () => {
    svc.getAllMenuItems.mockRejectedValue('s');
    const res = mockRes();
    await getAllMenuItemsHandler(req(), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });

  it('UNIT-M-MC-028 getMenuItemImageHandler', async () => {
    svc.getMenuItemImage.mockRejectedValue('s');
    const res = mockRes();
    await getMenuItemImageHandler(req({}, { menuItemId: 'm1' }), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });
});