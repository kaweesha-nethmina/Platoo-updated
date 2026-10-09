/**
 * UNIT tests - menu-service restaurant.controller.ts (SE4030 / SSD).
 * Services are mocked (no DB, no network). Focuses on request/response
 * wiring, error branching and the response STATUS codes.
 */
import {
  createRestaurantHandler,
  getRestaurantsHandler,
  updateRestaurantHandler,
  updateRestaurantOwnerHandler,
  deleteRestaurantHandler,
  getRestaurantByIdHandler,
  getRestaurantWithCategoriesAndMenuItemsHandler,
  getRestaurantsByOwnerIdHandler,
} from '../../../src/controllers/restaurant.controller';
import * as restaurantService from '../../../src/services/restaurant.service';

jest.mock('../../../src/services/restaurant.service', () => ({
  createRestaurant: jest.fn(),
  getRestaurants: jest.fn(),
  updateRestaurant: jest.fn(),
  deleteRestaurant: jest.fn(),
  getRestaurantById: jest.fn(),
  getRestaurantWithCategoriesAndMenuItems: jest.fn(),
  getRestaurantsByOwnerId: jest.fn(),
}));

const svc = restaurantService as jest.Mocked<typeof restaurantService>;

const mockRes = () =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }) as any;

const req = (body: any = {}, params: any = {}) =>
  ({ body, params }) as any;

const validBody = {
  owner_id: 'owner-123',
  name: 'Taco Place',
  image: 'http://x/y.png',
  rating: 4.5,
  deliveryTime: '30 min',
  deliveryFee: 'Rs. 150',
  minOrder: 'Rs. 500',
  distance: '2.5 km',
  cuisines: ['Mexican'],
  priceLevel: 2,
  location: { type: 'Point', coordinates: [79.86, 6.92], tag: 'Colombo' },
  open_time: '08:00 AM',
  closed_time: '10:00 PM',
};

describe('restaurant.controller createRestaurantHandler (POST /api/restaurants)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-RC-001 valid input → 201 + created restaurant', async () => {
    const created = { _id: 'r1', ...validBody };
    svc.createRestaurant.mockResolvedValue(created as any);
    const res = mockRes();

    await createRestaurantHandler(req(validBody), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
    expect(svc.createRestaurant).toHaveBeenCalledWith(validBody);
  });

  it('UNIT-M-RC-002 missing/extra fields are passed through verbatim (no validation/stripping)', async () => {
    const partial = { name: 'NoOwner' };
    svc.createRestaurant.mockResolvedValue({ _id: 'r2' } as any);
    const res = mockRes();

    await createRestaurantHandler(req(partial), res);
    expect(svc.createRestaurant).toHaveBeenCalledWith({
      owner_id: undefined,
      name: 'NoOwner',
      image: undefined,
      rating: undefined,
      deliveryTime: undefined,
      deliveryFee: undefined,
      minOrder: undefined,
      distance: undefined,
      cuisines: undefined,
      priceLevel: undefined,
      location: undefined,
      open_time: undefined,
      closed_time: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('UNIT-M-RC-003 boundary: 10000-char name accepted (no max-length validation)', async () => {
    const long = { ...validBody, name: 'A'.repeat(10000) };
    svc.createRestaurant.mockImplementation((d: any) => Promise.resolve(d) as any);
    const res = mockRes();

    await createRestaurantHandler(req(long), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect((res.json.mock.calls[0][0] as any).name).toHaveLength(10000);
  });

  it('UNIT-M-RC-004 boundary: negative rating & zero priceLevel accepted (no min validation)', async () => {
    const neg = { ...validBody, rating: -100, priceLevel: 0 };
    svc.createRestaurant.mockImplementation((d: any) => Promise.resolve(d) as any);
    const res = mockRes();

    await createRestaurantHandler(req(neg), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect((res.json.mock.calls[0][0] as any).rating).toBe(-100);
    expect((res.json.mock.calls[0][0] as any).priceLevel).toBe(0);
  });

  it('UNIT-M-RC-005 wrong-typed fields (name: 123, cuisines: "not-array") pass through', async () => {
    const wrong = { ...validBody, name: 123, cuisines: 'not-an-array' };
    svc.createRestaurant.mockImplementation((d: any) => Promise.resolve(d) as any);
    const res = mockRes();

    await createRestaurantHandler(req(wrong), res);
    expect((res.json.mock.calls[0][0] as any).name).toBe(123);
    expect((res.json.mock.calls[0][0] as any).cuisines).toBe('not-an-array');
  });

  it('UNIT-M-RC-006 service throws Error → 500 with the message', async () => {
    svc.createRestaurant.mockRejectedValue(new Error('E11000 duplicate key'));
    const res = mockRes();
    await createRestaurantHandler(req(validBody), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'E11000 duplicate key' });
  });

  it('UNIT-M-RC-007 service throws non-Error → 500 "An unknown error occurred"', async () => {
    svc.createRestaurant.mockRejectedValue('plain-string');
    const res = mockRes();
    await createRestaurantHandler(req(validBody), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });
});

describe('restaurant.controller getRestaurantsHandler (GET /api/restaurants)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-RC-008 success → 200 array', async () => {
    svc.getRestaurants.mockResolvedValue([{ _id: 'r1' }] as any);
    const res = mockRes();
    await getRestaurantsHandler(req(), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ _id: 'r1' }]);
  });

  it('UNIT-M-RC-009 empty store → 200 []', async () => {
    svc.getRestaurants.mockResolvedValue([] as any);
    const res = mockRes();
    await getRestaurantsHandler(req(), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('UNIT-M-RC-010 DB failure → 500', async () => {
    svc.getRestaurants.mockRejectedValue(new Error('db down'));
    const res = mockRes();
    await getRestaurantsHandler(req(), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'db down' });
  });
});

describe('restaurant.controller updateRestaurantHandler (PUT /:restaurantId)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-RC-011 found → 200 with updated document', async () => {
    svc.updateRestaurant.mockResolvedValue({ _id: 'r1', name: 'New Name' } as any);
    const res = mockRes();
    await updateRestaurantHandler(req({ name: 'New Name' }, { restaurantId: 'r1' }), res);
    expect(svc.updateRestaurant).toHaveBeenCalledWith('r1', { name: 'New Name' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ _id: 'r1', name: 'New Name' });
  });

  it('UNIT-M-RC-012 not found → 404 "Restaurant not found"', async () => {
    svc.updateRestaurant.mockResolvedValue(null as any);
    const res = mockRes();
    await updateRestaurantHandler(req({ name: 'x' }, { restaurantId: 'nope' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Restaurant not found' });
  });

  it('UNIT-M-RC-013 error → 500', async () => {
    svc.updateRestaurant.mockRejectedValue(new Error('CastError'));
    const res = mockRes();
    await updateRestaurantHandler(req({}, { restaurantId: 'bad-id' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('restaurant.controller updateRestaurantOwnerHandler (PATCH /:restaurantId/owner)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-RC-014 missing owner_id → 400 "Owner ID is required" (service NOT called)', async () => {
    const res = mockRes();
    await updateRestaurantOwnerHandler(req({}, { restaurantId: 'r1' }), res);
    expect(svc.updateRestaurant).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Owner ID is required' });
  });

  it('UNIT-M-RC-015 valid owner_id → 200', async () => {
    svc.updateRestaurant.mockResolvedValue({ _id: 'r1', owner_id: 'new-owner' } as any);
    const res = mockRes();
    await updateRestaurantOwnerHandler(req({ owner_id: 'new-owner' }, { restaurantId: 'r1' }), res);
    expect(svc.updateRestaurant).toHaveBeenCalledWith('r1', { owner_id: 'new-owner' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('UNIT-M-RC-016 restaurant not found → 404', async () => {
    svc.updateRestaurant.mockResolvedValue(null as any);
    const res = mockRes();
    await updateRestaurantOwnerHandler(req({ owner_id: 'x' }, { restaurantId: 'nope' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('UNIT-M-RC-017 error → 500', async () => {
    svc.updateRestaurant.mockRejectedValue(new Error('boom'));
    const res = mockRes();
    await updateRestaurantOwnerHandler(req({ owner_id: 'x' }, { restaurantId: 'r1' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('restaurant.controller deleteRestaurantHandler (DELETE /:restaurantId)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-RC-018 deleted → 200 + success message', async () => {
    svc.deleteRestaurant.mockResolvedValue({ _id: 'r1' } as any);
    const res = mockRes();
    await deleteRestaurantHandler(req({}, { restaurantId: 'r1' }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Restaurant deleted successfully' });
  });

  it('UNIT-M-RC-019 not found → 404', async () => {
    svc.deleteRestaurant.mockResolvedValue(null as any);
    const res = mockRes();
    await deleteRestaurantHandler(req({}, { restaurantId: 'nope' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Restaurant not found' });
  });

  it('UNIT-M-RC-020 error → 500', async () => {
    svc.deleteRestaurant.mockRejectedValue(new Error('Cast to ObjectId failed'));
    const res = mockRes();
    await deleteRestaurantHandler(req({}, { restaurantId: 'bad-id' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Cast to ObjectId failed' });
  });
});

describe('restaurant.controller getRestaurantByIdHandler (GET /:restaurantId)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-RC-021 found → 200', async () => {
    svc.getRestaurantById.mockResolvedValue({ _id: 'r1' } as any);
    const res = mockRes();
    await getRestaurantByIdHandler(req({}, { restaurantId: 'r1' }), res);
    expect(svc.getRestaurantById).toHaveBeenCalledWith('r1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('UNIT-M-RC-022 not found → 404', async () => {
    svc.getRestaurantById.mockResolvedValue(null as any);
    const res = mockRes();
    await getRestaurantByIdHandler(req({}, { restaurantId: 'nope' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Restaurant not found' });
  });

  it('UNIT-M-RC-023 malformed ObjectId (CastError) → 500 (defect in real app: no 400 mapping)', async () => {
    svc.getRestaurantById.mockRejectedValue(new Error('Cast to ObjectId failed for value "junk"'));
    const res = mockRes();
    await getRestaurantByIdHandler(req({}, { restaurantId: 'junk' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('restaurant.controller getRestaurantWithCategoriesAndMenuItemsHandler (GET /:restaurantId/details)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-RC-024 success → 200 { categories, menuItems }', async () => {
    const result = { categories: [{ _id: 'c1' }], menuItems: [{ _id: 'm1' }] };
    svc.getRestaurantWithCategoriesAndMenuItems.mockResolvedValue(result as any);
    const res = mockRes();
    await getRestaurantWithCategoriesAndMenuItemsHandler(req({}, { restaurantId: 'r1' }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('UNIT-M-RC-025 error → 500 (note: unknown restaurant id also 200 with empty arrays)', async () => {
    svc.getRestaurantWithCategoriesAndMenuItems.mockRejectedValue(new Error('db down'));
    const res = mockRes();
    await getRestaurantWithCategoriesAndMenuItemsHandler(req({}, { restaurantId: 'r1' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('restaurant.controller getRestaurantsByOwnerIdHandler (GET /owner/:ownerId)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-RC-026 success → 200 array', async () => {
    svc.getRestaurantsByOwnerId.mockResolvedValue([{ _id: 'r1' }] as any);
    const res = mockRes();
    await getRestaurantsByOwnerIdHandler(req({}, { ownerId: 'owner-123' }), res);
    expect(svc.getRestaurantsByOwnerId).toHaveBeenCalledWith('owner-123');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('UNIT-M-RC-027 error → 500 "Internal server error" (different message than other handlers)', async () => {
    svc.getRestaurantsByOwnerId.mockRejectedValue(new Error('anything'));
    const res = mockRes();
    await getRestaurantsByOwnerIdHandler(req({}, { ownerId: 'x' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

describe('restaurant.controller non-Error throw → 500 "An unknown error occurred" (catch-all branches)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-RC-028 getRestaurantsHandler', async () => {
    svc.getRestaurants.mockRejectedValue('string-err');
    const res = mockRes();
    await getRestaurantsHandler(req(), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });

  it('UNIT-M-RC-029 updateRestaurantHandler', async () => {
    svc.updateRestaurant.mockRejectedValue('string-err');
    const res = mockRes();
    await updateRestaurantHandler(req({}, { restaurantId: 'r1' }), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });

  it('UNIT-M-RC-030 updateRestaurantOwnerHandler', async () => {
    svc.updateRestaurant.mockRejectedValue('string-err');
    const res = mockRes();
    await updateRestaurantOwnerHandler(req({ owner_id: 'x' }, { restaurantId: 'r1' }), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });

  it('UNIT-M-RC-031 deleteRestaurantHandler', async () => {
    svc.deleteRestaurant.mockRejectedValue('string-err');
    const res = mockRes();
    await deleteRestaurantHandler(req({}, { restaurantId: 'r1' }), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });

  it('UNIT-M-RC-032 getRestaurantByIdHandler', async () => {
    svc.getRestaurantById.mockRejectedValue('string-err');
    const res = mockRes();
    await getRestaurantByIdHandler(req({}, { restaurantId: 'r1' }), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });

  it('UNIT-M-RC-033 getRestaurantWithCategoriesAndMenuItemsHandler', async () => {
    svc.getRestaurantWithCategoriesAndMenuItems.mockRejectedValue('string-err');
    const res = mockRes();
    await getRestaurantWithCategoriesAndMenuItemsHandler(req({}, { restaurantId: 'r1' }), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });
});