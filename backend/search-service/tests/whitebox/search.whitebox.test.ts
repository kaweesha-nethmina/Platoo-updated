/**
 * SEARCH-SERVICE - WHITE BOX unit tests.
 * These exercise internal logic: input sanitisation, query building and the
 * restaurant model. They require the hardened helpers introduced with the
 * security fix (src/utils/sanitize.ts). On the original code the imports do
 * not exist and the suite fails -> that failure is itself part of the
 * before/after evidence (see SEARCH-SERVICE-SECURITY-README.md).
 */
import { sanitizeSearchParam, sanitizePagination } from '../../src/utils/sanitize';
import RestaurantModel from '../../src/models/restaurant.model';

describe('sanitizeSearchParam (CWE-943 / CWE-1333 fix)', () => {
  test('rejects non-string values (NoSQL operator objects)', () => {
    expect(sanitizeSearchParam({ $ne: 'x' } as unknown as string)).toBeNull();
    expect(sanitizeSearchParam({ $gt: '' } as unknown as string)).toBeNull();
    expect(sanitizeSearchParam(['a'] as unknown as string)).toBeNull();
  });

test('escapes regex metacharacters before they reach $regex', () => {
    const out = sanitizeSearchParam('(a+)+$.*[x]');
    expect(out).toBe('\\(a\\+\\)\\+\\$\\.\\*\\[x\\]');
  });

  test('trims and caps length', () => {
    expect(sanitizeSearchParam('  pizza  ')).toBe('pizza');
    const long = 'a'.repeat(500);
    expect(sanitizeSearchParam(long)).toHaveLength(100);
    expect(sanitizeSearchParam('')).toBeNull();
    expect(sanitizeSearchParam(undefined as unknown as string)).toBeNull();
  });

  test('plain text passes through unchanged', () => {
    expect(sanitizeSearchParam('pizza heaven')).toBe('pizza heaven');
  });
});

describe('sanitizePagination', () => {
  test('clamps page/limit to safe ranges', () => {
    expect(sanitizePagination({ page: -5, limit: -1 })).toEqual({ page: 1, limit: 10 });
    expect(sanitizePagination({ page: 'abc', limit: '999999999' } as unknown as { page: number; limit: number })).toEqual({
      page: 1,
      limit: 100,
    });
    expect(sanitizePagination({})).toEqual({ page: 1, limit: 10 });
    expect(sanitizePagination({ page: 3, limit: 20 })).toEqual({ page: 3, limit: 20 });
  });
});

describe('restaurant model', () => {
  test('schema validates required fields', () => {
    expect(RestaurantModel.schema.paths.name).toBeDefined();
    expect(
      (RestaurantModel.schema.paths.name as unknown as { options: { required: boolean } }).options.required
    ).toBe(true);
  });
});