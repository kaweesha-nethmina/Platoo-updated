/**
 * UNIT tests - menu-service category.service.ts (SE4030 / SSD).
 * Mongoose models mocked; no DB, no network.
 */
import CategoryModel from '../../../src/models/category.model';
import {
  createCategory,
  getCategoriesByRestaurant,
  updateCategory,
  deleteCategory,
  getAllCategories,
} from '../../../src/services/category.service';

jest.mock('../../../src/models/category.model', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));

const model = CategoryModel as any;

const category = {
  restaurant_id: 'r1',
  name: 'Starters',
  description: 'Small plates',
  image_url: 'http://localhost:3001/uploads/starter.png',
  is_active: true,
};

describe('category.service createCategory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-CAT-001 passes payload to CategoryModel.create', async () => {
    model.create.mockResolvedValue({ _id: 'c1', ...category });
    await expect(createCategory(category)).resolves.toMatchObject({ _id: 'c1' });
    expect(model.create).toHaveBeenCalledWith(category);
  });

  it('UNIT-M-CAT-002 propagates a 500-worthy model failure', async () => {
    model.create.mockRejectedValue(new Error('duplicate key'));
    await expect(createCategory(category)).rejects.toThrow('duplicate key');
  });
});

describe('category.service getCategoriesByRestaurant', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-CAT-003 only returns ACTIVE categories for the restaurant', async () => {
    model.find.mockResolvedValue([{ _id: 'c1' }]);
    await expect(getCategoriesByRestaurant('r1')).resolves.toHaveLength(1);
    expect(model.find).toHaveBeenCalledWith({ restaurant_id: 'r1', is_active: true });
  });

  it('UNIT-M-CAT-004 returns [] when the restaurant has no active categories', async () => {
    model.find.mockResolvedValue([]);
    await expect(getCategoriesByRestaurant('r1')).resolves.toEqual([]);
  });
});

describe('category.service updateCategory / deleteCategory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-CAT-005 update uses findByIdAndUpdate with $set + {new: true}', async () => {
    model.findByIdAndUpdate.mockResolvedValue({ _id: 'c1', name: 'Mains' });
    await expect(updateCategory('c1', { name: 'Mains' })).resolves.toMatchObject({ name: 'Mains' });
    expect(model.findByIdAndUpdate).toHaveBeenCalledWith('c1', { $set: { name: 'Mains' } }, { new: true });
  });

  it('UNIT-M-CAT-006 update returns null for unknown id', async () => {
    model.findByIdAndUpdate.mockResolvedValue(null);
    await expect(updateCategory('nope', { name: 'x' })).resolves.toBeNull();
  });

  it('UNIT-M-CAT-007 delete calls findByIdAndDelete', async () => {
    model.findByIdAndDelete.mockResolvedValue({ _id: 'c1' });
    await expect(deleteCategory('c1')).resolves.toMatchObject({ _id: 'c1' });
    expect(model.findByIdAndDelete).toHaveBeenCalledWith('c1');
  });

  it('UNIT-M-CAT-008 delete returns null for unknown id', async () => {
    model.findByIdAndDelete.mockResolvedValue(null);
    await expect(deleteCategory('nope')).resolves.toBeNull();
  });
});

describe('category.service getAllCategories', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-CAT-009 returns ALL categories (incl. inactive) and populates restaurant name', async () => {
    const populated = [{ _id: 'c1', restaurant_id: { name: 'Taco Place' } }];
    model.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue(populated),
    });

    const result = await getAllCategories();
    expect(model.find).toHaveBeenCalledWith();
    expect(result).toEqual(populated);
  });

  it('UNIT-M-CAT-010 propagates a populate failure', async () => {
    model.find.mockReturnValue({
      populate: jest.fn().mockRejectedValue(new Error('populate failed')),
    });
    await expect(getAllCategories()).rejects.toThrow('populate failed');
  });
});