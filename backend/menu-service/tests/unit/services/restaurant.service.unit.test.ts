/**
 * UNIT tests - menu-service restaurant.service.ts (SE4030 / SSD).
 * Strategy: mock the three Mongoose models with jest.mock (no DB, no network).
 * Verify the exact query/option arguments the service passes to mongoose.
 */
import RestaurantModel from '../../../src/models/restaurant.model';
import CategoryModel from '../../../src/models/category.model';
import MenuItemModel from '../../../src/models/menuItem.model';
import {
  createRestaurant,
  getRestaurants,
  updateRestaurant,
  deleteRestaurant,
  getRestaurantById,
  getRestaurantWithCategoriesAndMenuItems,
  getRestaurantsByOwnerId,
} from '../../../src/services/restaurant.service';

jest.mock('../../../src/models/restaurant.model', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock('../../../src/models/category.model', () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

jest.mock('../../../src/models/menuItem.model', () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

const model = RestaurantModel as any;
const categoryModel = CategoryModel as any;
const menuItemModel = MenuItemModel as any;

const sample = {
  owner_id: 'owner-123',
  name: 'Taco Place',
  image: 'http://localhost:3001/uploads/taco.png',
  rating: 4.5,
  deliveryTime: '30 min',
  deliveryFee: 'Rs. 150',
  minOrder: 'Rs. 500',
  distance: '2.5 km',
  cuisines: ['Mexican', 'Burritos'],
  priceLevel: 2,
  location: { type: 'Point', coordinates: [79.8612, 6.9271], tag: 'Colombo' },
  open_time: '08:00 AM',
  closed_time: '10:00 PM',
};

describe('restaurant.service createRestaurant', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-RS-001 calls RestaurantModel.create with the exact payload', async () => {
    model.create.mockResolvedValue({ _id: 'r1', ...sample });
    await expect(createRestaurant(sample)).resolves.toMatchObject({ _id: 'r1' });
    expect(model.create).toHaveBeenCalledTimes(1);
    expect(model.create).toHaveBeenCalledWith(sample);
  });

  it('UNIT-M-RS-002 propagates mongodb/mongoose errors to the caller', async () => {
    model.create.mockRejectedValue(new Error('E11000 duplicate key'));
    await expect(createRestaurant(sample)).rejects.toThrow('E11000 duplicate key');
  });
});

describe('restaurant.service getRestaurants', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-RS-003 queries ONLY active restaurants (is_active: true)', async () => {
    const docs = [{ _id: 'r1' }, { _id: 'r2' }];
    model.find.mockResolvedValue(docs);
    await expect(getRestaurants()).resolves.toEqual(docs);
    expect(model.find).toHaveBeenCalledTimes(1);
    expect(model.find).toHaveBeenCalledWith({ is_active: true });
  });

  it('UNIT-M-RS-004 returns an empty array → 200 [] (no restaurants seeded)', async () => {
    model.find.mockResolvedValue([]);
    await expect(getRestaurants()).resolves.toEqual([]);
  });

  it('UNIT-M-RS-005 propagates a failed read', async () => {
    model.find.mockRejectedValue(new Error('connection lost'));
    await expect(getRestaurants()).rejects.toThrow('connection lost');
  });
});

describe('restaurant.service updateRestaurant', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-RS-006 uses findByIdAndUpdate with $set + {new: true}', async () => {
    const updated = { _id: 'r1', name: 'Renamed' };
    model.findByIdAndUpdate.mockResolvedValue(updated);
    await expect(updateRestaurant('r1', { name: 'Renamed' })).resolves.toEqual(updated);
    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'r1',
      { $set: { name: 'Renamed' } },
      { new: true }
    );
  });

  it('UNIT-M-RS-007 returns null when the restaurant id does not exist', async () => {
    model.findByIdAndUpdate.mockResolvedValue(null);
    await expect(updateRestaurant('nosuch', { name: 'x' })).resolves.toBeNull();
  });
});

describe('restaurant.service deleteRestaurant', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-RS-008 deletes by id', async () => {
    model.findByIdAndDelete.mockResolvedValue({ _id: 'r1' });
    await expect(deleteRestaurant('r1')).resolves.toMatchObject({ _id: 'r1' });
    expect(model.findByIdAndDelete).toHaveBeenCalledWith('r1');
  });

  it('UNIT-M-RS-009 returns null for an unknown id', async () => {
    model.findByIdAndDelete.mockResolvedValue(null);
    await expect(deleteRestaurant('nosuch')).resolves.toBeNull();
  });
});

describe('restaurant.service getRestaurantById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-RS-010 finds by id and returns the document', async () => {
    model.findById.mockResolvedValue({ _id: 'r1' });
    await expect(getRestaurantById('r1')).resolves.toMatchObject({ _id: 'r1' });
    expect(model.findById).toHaveBeenCalledWith('r1');
  });

  it('UNIT-M-RS-011 returns null when not found', async () => {
    model.findById.mockResolvedValue(null);
    await expect(getRestaurantById('r1')).resolves.toBeNull();
  });

  it('UNIT-M-RS-012 rethrows (does not swallow) a CastError for a malformed id', async () => {
    model.findById.mockRejectedValue(new Error('Cast to ObjectId failed'));
    await expect(getRestaurantById('not-an-objectid')).rejects.toThrow('Cast to ObjectId failed');
  });
});

describe('restaurant.service getRestaurantWithCategoriesAndMenuItems', () => {
  beforeEach(() => jest.clearAllMocks());
  const cat1 = { _id: 'c1', name: 'Starters' };
  const cat2 = { _id: 'c2', name: 'Desserts' };

  it('UNIT-M-RS-013 returns { categories, menuItems } with only available menu items', async () => {
    categoryModel.find.mockResolvedValue([cat1, cat2]);
    menuItemModel.find.mockResolvedValue([{ _id: 'm1', name: 'Nachos' }]);

    const result = await getRestaurantWithCategoriesAndMenuItems('r1');
    expect(result).toEqual({ categories: [cat1, cat2], menuItems: [{ _id: 'm1', name: 'Nachos' }] });

    expect(categoryModel.find).toHaveBeenCalledWith({ restaurant_id: 'r1', is_active: true });
    expect(menuItemModel.find).toHaveBeenCalledWith({
      category_id: { $in: ['c1', 'c2'] },
      is_available: true,
    });
  });

  it('UNIT-M-RS-014 restaurant with no active categories → $in an empty list', async () => {
    categoryModel.find.mockResolvedValue([]);
    await getRestaurantWithCategoriesAndMenuItems('r1');
    expect(menuItemModel.find).toHaveBeenCalledWith({
      category_id: { $in: [] },
      is_available: true,
    });
  });

  it('UNIT-M-RS-015 propagates failures', async () => {
    categoryModel.find.mockRejectedValue(new Error('db down'));
    await expect(getRestaurantWithCategoriesAndMenuItems('r1')).rejects.toThrow('db down');
  });
});

describe('restaurant.service getRestaurantsByOwnerId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-RS-016 filters by owner_id (note: does NOT filter is_active)', async () => {
    model.find.mockResolvedValue([{ _id: 'r1' }]);
    await expect(getRestaurantsByOwnerId('owner-123')).resolves.toHaveLength(1);
    expect(model.find).toHaveBeenCalledWith({ owner_id: 'owner-123' });
  });
});