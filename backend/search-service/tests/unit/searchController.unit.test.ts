/**
 * SEARCH-SERVICE - UNIT tests: controller query building + status codes.
 * RestaurantModel.find and the axios-backed handlers are mocked so no Mongo
 * connection or external menu-service call is made.
 */
import type { Request, Response } from 'express';
import axios from 'axios';
import RestaurantModel from '../../src/models/restaurant.model';
import { searchMenuItems } from '../../src/services/search.service';
import {
  handleRestaurantSearch,
  handleMenuItemSearch,
  handleCategorySearch,
} from '../../src/controllers/search.controller';
import { sanitizeSearchParam, sanitizePlainText, sanitizePagination } from '../../src/utils/sanitize';

jest.mock('../../src/models/restaurant.model', () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock('axios');
jest.mock('../../src/services/search.service', () => ({
  searchMenuItems: jest.fn(),
}));

const mockFind = RestaurantModel.find as jest.MockedFunction<typeof RestaurantModel.find>;
const mockSearchMenuItems = searchMenuItems as jest.MockedFunction<typeof searchMenuItems>;
const mockAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>;

function makeRes(): Response {
  const res = { statusCode: 0, body: undefined, status: jest.fn(), json: jest.fn() } as unknown as Response;
  (res.status as jest.Mock).mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  (res.json as jest.Mock).mockImplementation((body: unknown) => {
    (res as Response & { body: unknown }).body = body;
    return res;
  });
  return res;
}

// Chainable .find() mock: skip/limit/maxTimeMS resolve to seeded rows.
function mockChain(rows: unknown[]) {
  const chain = { skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), maxTimeMS: jest.fn() };
  (chain.maxTimeMS as jest.Mock).mockReturnValue(Promise.resolve(rows));
  mockFind.mockReturnValue(chain as never);
  return chain;
}

beforeEach(() => jest.clearAllMocks());

describe('handleRestaurantSearch', () => {
  test('returns 400 when no valid search parameter is provided', async () => {
    const res = makeRes();
    await handleRestaurantSearch({ query: {} } as Request, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect((res as Response & { body: unknown }).body).toEqual({ message: 'At least one search parameter is required' });
    expect(mockFind).not.toHaveBeenCalled();
  });

  test('builds regex filters for name, location.tag and cuisines and applies pagination + time cap', async () => {
    const savedQuery = { skip: jest.fn(), limit: jest.fn(), maxTimeMS: jest.fn() };
    (savedQuery.skip as jest.Mock).mockReturnValue(savedQuery);
    (savedQuery.limit as jest.Mock).mockReturnValue(savedQuery);
    (savedQuery.maxTimeMS as jest.Mock).mockResolvedValue([{ name: 'Pizza Palace' }]);
    mockFind.mockReturnValue(savedQuery as never);

    const res = makeRes();
    await handleRestaurantSearch(
      { query: { query: 'pizza', location: 'Colombo', cuisine: 'Italian', page: '2', limit: '5' } } as unknown as Request,
      res
    );

    expect(mockFind).toHaveBeenCalledWith({
      name: { $regex: 'pizza', $options: 'i' },
      'location.tag': { $regex: '^Colombo$', $options: 'i' },
      cuisines: { $regex: 'Italian', $options: 'i' },
    });
    expect(savedQuery.skip).toHaveBeenCalledWith(5); // (page-1) * limit
    expect(savedQuery.limit).toHaveBeenCalledWith(5);
    expect(savedQuery.maxTimeMS).toHaveBeenCalledWith(2000);
    expect(res.status).toHaveBeenCalledWith(200);
    expect((res as Response & { body: unknown }).body).toEqual([{ name: 'Pizza Palace' }]);
  });

  test('returns 200 with an empty array (not an error) when no restaurants match', async () => {
    mockChain([]);
    const res = makeRes();
    await handleRestaurantSearch({ query: { query: 'zzz' } } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect((res as Response & { body: unknown }).body).toEqual([]);
  });

  test('regex metacharacters in the input are escaped before reaching $regex', async () => {
    mockChain([]);
    const res = makeRes();
    await handleRestaurantSearch({ query: { query: '(a+)+$.*' } } as unknown as Request, res);
    expect(mockFind).toHaveBeenCalledWith({
      name: { $regex: '\\(a\\+\\)\\+\\$\\.\\*', $options: 'i' },
    });
  });

  test('returns 500 JSON on a database error', async () => {
    // Reject via maxTimeMS (awaited inside the controller) so no detached
    // rejected promise trips an unhandled-rejection crash.
    mockFind.mockReturnValue({
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maxTimeMS: jest.fn().mockRejectedValue(new Error('db down')),
    } as never);
    const res = makeRes();
    await handleRestaurantSearch({ query: { query: 'pizza' } } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect((res as Response & { body: unknown }).body).toEqual({ message: 'Internal Server Error' });
  });
});

describe('handleMenuItemSearch', () => {
  test('returns 400 when query is missing', async () => {
    const res = makeRes();
    await handleMenuItemSearch({ query: {} } as Request, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSearchMenuItems).not.toHaveBeenCalled();
  });

  test('delegates to searchMenuItems with the sanitised query and returns the result', async () => {
    mockSearchMenuItems.mockResolvedValue([{ name: 'Kottu' }]);
    const res = makeRes();
    await handleMenuItemSearch({ query: { query: 'kottu' } } as unknown as Request, res);
    expect(mockSearchMenuItems).toHaveBeenCalledWith('kottu');
    expect(res.status).toHaveBeenCalledWith(200);
    expect((res as Response & { body: unknown }).body).toEqual([{ name: 'Kottu' }]);
  });

  test('returns 500 JSON when the menu service errors', async () => {
    mockSearchMenuItems.mockRejectedValue(new Error('menu service down'));
    const res = makeRes();
    await handleMenuItemSearch({ query: { query: 'kottu' } } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('handleCategorySearch', () => {
  test('returns 400 when query is missing', async () => {
    const res = makeRes();
    await handleCategorySearch({ query: {} } as Request, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  test('returns matching categories from the menu service', async () => {
    mockAxiosGet.mockResolvedValue({ data: [{ name: 'Burgers' }, { name: 'Pizza' }] });
    const res = makeRes();
    await handleCategorySearch({ query: { query: 'PIZZA' } } as unknown as Request, res);
    expect(mockAxiosGet).toHaveBeenCalledWith('http://localhost:3001/api/category');
    expect(res.status).toHaveBeenCalledWith(200);
    expect((res as Response & { body: unknown }).body).toEqual([{ name: 'Pizza' }]);
  });

  test('returns 404 when no category matches', async () => {
    mockAxiosGet.mockResolvedValue({ data: [{ name: 'Burgers' }] });
    const res = makeRes();
    await handleCategorySearch({ query: { query: 'Sushi' } } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect((res as Response & { body: unknown }).body).toEqual({ message: 'Category not found' });
  });

  test('returns 500 JSON when the menu service errors', async () => {
    mockAxiosGet.mockRejectedValue(new Error('menu service down'));
    const res = makeRes();
    await handleCategorySearch({ query: { query: 'Pizza' } } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect((res as Response & { body: unknown }).body).toEqual({ message: 'Error fetching category details' });
  });
});

describe('sanitize helpers (direct coverage)', () => {
  test('sanitizeSearchParam rejects objects and escapes regex', () => {
    expect(sanitizeSearchParam({ $regex: 'x' })).toBeNull();
    expect(sanitizeSearchParam('a.b*')).toBe('a\\.b\\*');
  });

  test('sanitizePlainText trims but does not regex-escape', () => {
    expect(sanitizePlainText('  Sushi  ')).toBe('Sushi');
    expect(sanitizePlainText('a.b')).toBe('a.b');
    expect(sanitizePlainText(['x'])).toBeNull();
  });

  test('sanitizePagination clamps defaults', () => {
    expect(sanitizePagination({})).toEqual({ page: 1, limit: 10 });
    expect(sanitizePagination({ page: '2', limit: '1000' })).toEqual({ page: 2, limit: 100 });
  });
});