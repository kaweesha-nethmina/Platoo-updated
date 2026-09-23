/**
 * SEARCH-SERVICE - UNIT tests: searchMenuItems service function.
 * Axios is mocked so no real HTTP call to the external menu service occurs.
 */
import axios from 'axios';
import { searchMenuItems } from '../../src/services/search.service';

jest.mock('axios');

const mockAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>;

beforeEach(() => jest.clearAllMocks());

describe('searchMenuItems', () => {
  test('queries the menu service with the sanitised query as a query param', async () => {
    mockAxiosGet.mockResolvedValue({
      data: [
        { name: 'Chicken Kottu' },
        { name: 'Kottu' },
        { name: 'Chicken' },
      ],
    });
    const items = await searchMenuItems('kottu');
    expect(mockAxiosGet).toHaveBeenCalledWith('http://localhost:3001/api/menu-items', {
      params: { query: 'kottu' },
    });
    // Exact (case-insensitive) match filter is applied client-side.
    expect(items).toEqual([{ name: 'Kottu' }]);
  });

  test('returns an empty array when nothing matches exactly', async () => {
    mockAxiosGet.mockResolvedValue({ data: [{ name: 'Pizza' }] });
    const items = await searchMenuItems('sushi');
    expect(items).toEqual([]);
  });

  test('rethrows service errors for the controller to map to 500', async () => {
    mockAxiosGet.mockRejectedValue(new Error('menu service down'));
    await expect(searchMenuItems('kottu')).rejects.toThrow('menu service down');
  });
});