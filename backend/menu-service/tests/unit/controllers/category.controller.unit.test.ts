/**
 * UNIT tests - menu-service category.controller.ts (SE4030 / SSD).
 * Services are mocked; no DB, no network.
 */
import {
  createCategoryHandler,
  getCategoriesByRestaurantHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
  getAllCategoriesHandler,
} from '../../../src/controllers/category.controller';
import * as categoryService from '../../../src/services/category.service';

jest.mock('../../../src/services/category.service', () => ({
  createCategory: jest.fn(),
  getCategoriesByRestaurant: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
  getAllCategories: jest.fn(),
}));

const svc = categoryService as jest.Mocked<typeof categoryService>;

const mockRes = () =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }) as any;

const req = (body: any = {}, params: any = {}) => ({ body, params }) as any;

const validCategory = {
  restaurant_id: 'r1',
  name: 'Starters',
  description: 'Small plates',
  image_url: 'http://x/s.png',
  is_active: true,
};

describe('category.controller createCategoryHandler (POST /api/category)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-CC-001 valid input → 201', async () => {
    svc.createCategory.mockImplementation((d: any) => Promise.resolve({ _id: 'c1', ...d }) as any);
    const res = mockRes();
    await createCategoryHandler(req(validCategory), res);
    expect(svc.createCategory).toHaveBeenCalledWith(validCategory);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ _id: 'c1', ...validCategory });
  });

  it('UNIT-M-CC-002 empty body passes through → 201 (no validation), service in charge', async () => {
    svc.createCategory.mockImplementation((d: any) => Promise.resolve(d) as any);
    const res = mockRes();
    await createCategoryHandler(req({}), res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('UNIT-M-CC-003 service error → 500', async () => {
    svc.createCategory.mockRejectedValue(new Error('invalid'));
    const res = mockRes();
    await createCategoryHandler(req(validCategory), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'invalid' });
  });
});

describe('category.controller getCategoriesByRestaurantHandler (GET /:restaurantId)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-CC-004 success → 200 array, passes restaurantId param', async () => {
    svc.getCategoriesByRestaurant.mockResolvedValue([{ _id: 'c1' }] as any);
    const res = mockRes();
    await getCategoriesByRestaurantHandler(req({}, { restaurantId: 'r1' }), res);
    expect(svc.getCategoriesByRestaurant).toHaveBeenCalledWith('r1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('UNIT-M-CC-005 failure → 500', async () => {
    svc.getCategoriesByRestaurant.mockRejectedValue(new Error('db'));
    const res = mockRes();
    await getCategoriesByRestaurantHandler(req({}, { restaurantId: 'r1' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('category.controller updateCategoryHandler (PUT /:categoryId)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-CC-006 found → 200 with updated doc', async () => {
    svc.updateCategory.mockResolvedValue({ _id: 'c1', name: 'Mains' } as any);
    const res = mockRes();
    await updateCategoryHandler(req({ name: 'Mains' }, { categoryId: 'c1' }), res);
    expect(svc.updateCategory).toHaveBeenCalledWith('c1', { name: 'Mains' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('UNIT-M-CC-007 DEFECT: not found → 404 attempted, then 200 not-found doc sent', async () => {
    svc.updateCategory.mockResolvedValue(null as any);
    const res = mockRes();
    await updateCategoryHandler(req({}, { categoryId: 'nope' }), res);
    expect(res.status).toHaveBeenNthCalledWith(1, 404);
    expect(res.json).toHaveBeenNthCalledWith(1, { error: 'Category not found' });
    expect(res.status).toHaveBeenNthCalledWith(2, 200);
    expect(res.json).toHaveBeenNthCalledWith(2, null);
  });

  it('UNIT-M-CC-008 error → 500', async () => {
    svc.updateCategory.mockRejectedValue(new Error('CastError'));
    const res = mockRes();
    await updateCategoryHandler(req({}, { categoryId: 'bad' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('category.controller deleteCategoryHandler (DELETE /:categoryId)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-CC-009 deleted → 200 "Category deleted successfully"', async () => {
    svc.deleteCategory.mockResolvedValue({ _id: 'c1' } as any);
    const res = mockRes();
    await deleteCategoryHandler(req({}, { categoryId: 'c1' }), res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('UNIT-M-CC-010 DEFECT: not found → 404 attempted, then 200 message', async () => {
    svc.deleteCategory.mockResolvedValue(null as any);
    const res = mockRes();
    await deleteCategoryHandler(req({}, { categoryId: 'nope' }), res);
    expect(res.status).toHaveBeenNthCalledWith(1, 404);
    expect(res.status).toHaveBeenNthCalledWith(2, 200);
    expect(res.json).toHaveBeenNthCalledWith(2, { message: 'Category deleted successfully' });
  });

  it('UNIT-M-CC-011 error → 500', async () => {
    svc.deleteCategory.mockRejectedValue(new Error('db'));
    const res = mockRes();
    await deleteCategoryHandler(req({}, { categoryId: 'c1' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('category.controller getAllCategoriesHandler (GET /api/category)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-CC-012 success → 200 array', async () => {
    svc.getAllCategories.mockResolvedValue([{ _id: 'c1' }] as any);
    const res = mockRes();
    await getAllCategoriesHandler(req(), res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('UNIT-M-CC-013 failure → 500', async () => {
    svc.getAllCategories.mockRejectedValue(new Error('db'));
    const res = mockRes();
    await getAllCategoriesHandler(req(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('category.controller non-Error throw → 500 "An unknown error occurred" (catch-all branches)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-M-CC-014 createCategoryHandler', async () => {
    svc.createCategory.mockRejectedValue('s');
    const res = mockRes();
    await createCategoryHandler(req({}), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });

  it('UNIT-M-CC-015 getCategoriesByRestaurantHandler', async () => {
    svc.getCategoriesByRestaurant.mockRejectedValue('s');
    const res = mockRes();
    await getCategoriesByRestaurantHandler(req({}, { restaurantId: 'r1' }), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });

  it('UNIT-M-CC-016 updateCategoryHandler', async () => {
    svc.updateCategory.mockRejectedValue('s');
    const res = mockRes();
    await updateCategoryHandler(req({}, { categoryId: 'c1' }), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });

  it('UNIT-M-CC-017 deleteCategoryHandler', async () => {
    svc.deleteCategory.mockRejectedValue('s');
    const res = mockRes();
    await deleteCategoryHandler(req({}, { categoryId: 'c1' }), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });

  it('UNIT-M-CC-018 getAllCategoriesHandler', async () => {
    svc.getAllCategories.mockRejectedValue('s');
    const res = mockRes();
    await getAllCategoriesHandler(req(), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'An unknown error occurred' });
  });
});