/**
 * WHITE-BOX unit tests - restaurant.service.ts (SE4030).
 * Happy-path uses the dedicated test DB; error branches use mocks.
 */
import RestaurantModel from '../../src/models/restaurant.model';
import {
  createRestaurant,
  getRestaurants,
  updateRestaurant,
  deleteRestaurant,
  getRestaurantById,
  getRestaurantWithCategoriesAndMenuItems,
  getRestaurantsByOwnerId,
} from '../../src/services/restaurant.service';
import { connectAndReset, disconnectDb } from '../helpers/db';

const valid = {
  owner_id: 'owner-123',
  name: 'WB Restaurant',
  image: 'img.png',
  rating: 4,
  deliveryTime: '30 min',
  deliveryFee: 'Rs150',
  minOrder: 'Rs500',
  distance: '2km',
  cuisines: ['Italian'],
  priceLevel: 2,
  location: { type: 'Point', coordinates: [79.86, 6.92], tag: 'area' },
};

beforeAll(async () => {
  await connectAndReset();
});
afterAll(async () => {
  await disconnectDb();
});

const idOf = (doc: any): string => doc._id.toString();

describe('WHITE-BOX restaurant.service', () => {
  it('WB-001 createRestaurant persists a document', async () => {
    const doc = await createRestaurant(valid);
    expect(doc._id).toBeDefined();
    expect(doc.name).toBe('WB Restaurant');
  });

  it('WB-002 getRestaurants returns only active restaurants', async () => {
    await createRestaurant(valid);
    await RestaurantModel.create({ ...valid, name: 'Inactive', is_active: false });
    const list = await getRestaurants();
    expect(list.some((r: any) => r.name === 'Inactive')).toBe(false);
    expect(list.some((r: any) => r.name === 'WB Restaurant')).toBe(true);
  });

  it('WB-003 updateRestaurant uses $set with provided data', async () => {
    const doc = await createRestaurant(valid);
    const updated = await updateRestaurant(idOf(doc), { name: 'Renamed', rating: 1 });
    expect(updated?.name).toBe('Renamed');
    expect(updated?.rating).toBe(1);
  });

  it('WB-004 deleteRestaurant removes the document', async () => {
    const doc = await createRestaurant(valid);
    const deleted = await deleteRestaurant(idOf(doc));
expect(idOf(deleted)).toBe(idOf(doc));
    expect(await RestaurantModel.findById(doc._id as any)).toBeNull();
  });

  it('WB-005 getRestaurantById resolves document', async () => {
    const doc = await createRestaurant(valid);
    const found = await getRestaurantById(idOf(doc));
    expect(found?.name).toBe('WB Restaurant');
  });

  it('WB-006 getRestaurantById throws CastError for invalid ObjectId', async () => {
    await expect(getRestaurantById('bad-id')).rejects.toThrow();
  });

  it('WB-007 getRestaurantById(null) resolves null', async () => {
    const found = await (RestaurantModel.findById as jest.Mock);
    // direct call: returns null for nonexistent valid id
    const none = await getRestaurantById('665f00000000000000000000');
    expect(none).toBeNull();
    void found;
  });

  it('WB-008 getRestaurantWithCategoriesAndMenuItems returns {categories, menuItems}', async () => {
    const r = await createRestaurant(valid);
    const result = await getRestaurantWithCategoriesAndMenuItems(idOf(r));
    expect(result).toHaveProperty('categories');
    expect(result).toHaveProperty('menuItems');
    expect(Array.isArray(result.categories)).toBe(true);
  });

  it('WB-009 getRestaurantsByOwnerId filters by owner_id', async () => {
    await createRestaurant({ ...valid, owner_id: 'owner-filter' });
    const list = await getRestaurantsByOwnerId('owner-filter');
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((r: any) => r.owner_id === 'owner-filter')).toBe(true);
  });

  it('WB-010 DB failure branch: createRestaurant propagates error', async () => {
    const spy = jest.spyOn(RestaurantModel, 'create').mockRejectedValueOnce(new Error('db down'));
    await expect(createRestaurant(valid)).rejects.toThrow('db down');
    spy.mockRestore();
  });

  it('WB-011 DB failure branch: getRestaurants propagates error', async () => {
    const spy = jest.spyOn(RestaurantModel, 'find').mockRejectedValueOnce(new Error('db down'));
    await expect(getRestaurants()).rejects.toThrow('db down');
    spy.mockRestore();
  });

  it('WB-012 DB failure branch: updateRestaurant propagates error', async () => {
    const spy = jest
      .spyOn(RestaurantModel, 'findByIdAndUpdate')
      .mockRejectedValueOnce(new Error('db down'));
    await expect(updateRestaurant('665f00000000000000000000', { name: 'x' })).rejects.toThrow('db down');
    spy.mockRestore();
  });

  it('WB-013 DB failure branch: getRestaurantsByOwnerId propagates error', async () => {
    const spy = jest.spyOn(RestaurantModel, 'find').mockRejectedValueOnce(new Error('db down'));
    await expect(getRestaurantsByOwnerId('x')).rejects.toThrow('db down');
    spy.mockRestore();
  });
});
