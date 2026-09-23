/**
 * Input sanitisation helpers for the search service.
 *
 * SRCH-01 (CWE-943): query params such as `?query[$ne]=x` arrive as objects
 * (Express/qs parses `[$ne]` into a nested key `$ne`). Unvalidated, they flow
 * into MongoDB query operators ($regex/$gt/$ne ...) and either crash the
 * request with a 500 or alter query semantics. We require single plain strings
 * and reject anything else with a clean 400.
 *
 * SRCH-02 (CWE-1333): every string that reaches a $regex operator is escaped,
 * so user input can never inject regex metacharacters (ReDoS, broad `.*`
 * matching, operator tampering inside the pattern).
 */

import escapeRegex from 'escape-string-regexp';

const MAX_SEARCH_LENGTH = 100;

/**
 * Coerces an unknown query parameter into a safe search string.
 * Returns null when the value is not a plain non-empty string (defeats NoSQL
 * operator objects such as {$ne:...}) and regex-escapes the result so the
 * string can be safely embedded in a Mongo $regex (defeats ReDoS).
 */
export function sanitizeSearchParam(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return escapeRegex(trimmed.slice(0, MAX_SEARCH_LENGTH));
}

/**
 * Plain-text variant used for exact-match comparisons (category search).
 * Unlike sanitizeSearchParam it does not regex-escape (escaping would break
 * string equality with stored values). It still rejects objects/arrays/empty.
 */
export function sanitizePlainText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_SEARCH_LENGTH);
}

/**
 * Clamps page/limit (SRCH-03, CWE-770) to safe ranges so one request can never
 * materialise an unbounded result set. limit is capped at 100 per request.
 * Wired into the restaurant search in the SRCH-03 fix.
 */
export function sanitizePagination(input: { page?: unknown; limit?: unknown }): {
  page: number;
  limit: number;
} {
  const rawPage = Number.parseInt(String(input.page ?? ''), 10);
  const rawLimit = Number.parseInt(String(input.limit ?? ''), 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 10;

  return { page, limit };
}