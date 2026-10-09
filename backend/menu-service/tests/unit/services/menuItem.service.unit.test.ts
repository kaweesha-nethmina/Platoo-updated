/**
 * UNIT tests - menu-service menuItem.service.ts (SE4030 / SSD).
 * Mongoose models mocked; no DB, no network.
 */
import MenuItemModel from '../../../src/models/menuItem.model';
import CategoryModel from '../../../src/models/category.model';
import {
  createMenuItem,
  getMenuItemsByCategory,
  updateMenuItem,
  deleteMenuItem,
  getMenuItemsByRestaurant,
  getAllMenuItems,
  getMenuItemImage,
} from '../../../src/services/menuItem.service';

jest.mock('../../../src/models/menuItem.model', () => ({
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

const model = MenuItemModel as any;
const categoryModel = CategoryModel as any;

const item = {
  category_id: 'c1',
  name: 'Margherita',
  description: 'Classic',
  price: 1200,
  image_url: 'http://localhost:3001/uploads/m.png',
  is_veg: true,
  is_available: true,
};

describe('menuItem.service createMenuItem', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-MI-001 passes the payload through to MenuItemModel.create', async () => {
    model.create.mockResolvedValue({ _id: 'm1', ...item });
    await expect(createMenuItem(item)).resolves.toMatchObject({ _id: 'm1' });
    expect(model.create).toHaveBeenCalledWith(item);
  });

  it('UNIT-M-MI-002 propagates validation errors (e.g. price required)', async () => {
    model.create.mockRejectedValue(new Error('Path `price` is required.'));
    await expect(createMenuItem({})).rejects.toThrow('price');
  });
});

describe('menuItem.service getMenuItemsByCategory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-MI-003 filters by category_id and is_available: true', async () => {
    model.find.mockResolvedValue([{ _id: 'm1' }]);
    await expect(getMenuItemsByCategory('c1')).resolves.toHaveLength(1);
    expect(model.find).toHaveBeenCalledWith({ category_id: 'c1', is_available: true });
  });

  it('UNIT-M-MI-004 returns [] for a category with no available items', async () => {
    model.find.mockResolvedValue([]);
    await expect(getMenuItemsByCategory('empty')).resolves.toEqual([]);
  });

  it('UNIT-M-MI-005 propagates a failed query', async () => {
    model.find.mockRejectedValue(new Error('read timeout'));
    await expect(getMenuItemsByCategory('c1')).rejects.toThrow('read timeout');
  });
});

describe('menuItem.service updateMenuItem / deleteMenuItem', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-MI-006 update uses findByIdAndUpdate with $set + {new: true}', async () => {
    model.findByIdAndUpdate.mockResolvedValue({ _id: 'm1', price: 1300 });
    await expect(updateMenuItem('m1', { price: 1300 })).resolves.toMatchObject({ price: 1300 });
    expect(model.findByIdAndUpdate).toHaveBeenCalledWith('m1', { $set: { price: 1300 } }, { new: true });
  });

  it('UNIT-M-MI-007 update returns null for unknown id', async () => {
    model.findByIdAndUpdate.mockResolvedValue(null);
    await expect(updateMenuItem('nope', { price: 1 })).resolves.toBeNull();
  });

  it('UNIT-M-MI-008 delete calls findByIdAndDelete', async () => {
    model.findByIdAndDelete.mockResolvedValue({ _id: 'm1' });
    await expect(deleteMenuItem('m1')).resolves.toMatchObject({ _id: 'm1' });
    expect(model.findByIdAndDelete).toHaveBeenCalledWith('m1');
  });

  it('UNIT-M-MI-009 delete returns null for unknown id', async () => {
    model.findByIdAndDelete.mockResolvedValue(null);
    await expect(deleteMenuItem('nope')).resolves.toBeNull();
  });
});

describe('menuItem.service getMenuItemsByRestaurant', () => {
  beforeEach(() => jest.clearAllMocks());
  const cats = [{ _id: 'c1' }, { _id: 'c2' }];

  it('UNIT-M-MI-010 resolves categories first, then menu items with $in category ids', async () => {
    categoryModel.find.mockResolvedValue(cats);
    model.find.mockResolvedValue([{ _id: 'm1', name: 'Pasta' }]);

    const result = await getMenuItemsByRestaurant('r1');
    expect(result).toEqual([{ _id: 'm1', name: 'Pasta' }]);
    expect(categoryModel.find).toHaveBeenCalledWith({ restaurant_id: 'r1' });
    expect(model.find).toHaveBeenCalledWith({
      category_id: { $in: ['c1', 'c2'] },
      is_available: true,
    });
  });

  it('UNIT-M-MI-011 restaurant with no categories → [] (no menu query needed)', async () => {
    categoryModel.find.mockResolvedValue([]);
    model.find.mockResolvedValue([]);
    await expect(getMenuItemsByRestaurant('noval-resto')).resolves.toEqual([]);
  });

  it('UNIT-M-MI-012 propagates category lookup failure', async () => {
    categoryModel.find.mockRejectedValue(new Error('categories down'));
    await expect(getMenuItemsByRestaurant('r1')).rejects.toThrow('categories down');
  });
});

describe('menuItem.service getAllMenuItems', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-MI-013 filters is_available: true and populates category name', async () => {
    const populated = [{ _id: 'm1', category_id: { name: 'Pizza' } }];
    // find() must return a chainable { populate }
    model.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue(populated),
    });

    const result = await getAllMenuItems();
    expect(model.find).toHaveBeenCalledWith({ is_available: true });
    expect(result).toEqual(populated);
  });

  it('UNIT-M-MI-014 propagates failures', async () => {
    model.find.mockReturnValue({
      populate: jest.fn().mockRejectedValue(new Error('populate failed')),
    });
    await expect(getAllMenuItems()).rejects.toThrow('populate failed');
  });
});

describe('menuItem.service getMenuItemImage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-MI-015 returns { image_url } only (projection image_url)', async () => {
    model.findById.mockResolvedValue({ _id: 'm1', image_url: 'http://x/y.png', price: 5 });
    await expect(getMenuItemImage('m1')).resolves.toEqual({
      image_url: 'http://x/y.png',
    });
    expect(model.findById).toHaveBeenCalledWith('m1', 'image_url');
  });

  it('UNIT-M-MI-016 returns null for a missing menu item or missing image', async () => {
    model.findById.mockResolvedValue(null);
    await expect(getMenuItemImage('m1')).resolves.toBeNull();
  });

  it('UNIT-M-MI-017 propagates malformed-id errors', async () => {
    model.findById.mockRejectedValue(new Error('Cast to ObjectId failed'));
    await expect(getMenuItemImage('junk')).rejects.toThrow('Cast to ObjectId');
  });
});