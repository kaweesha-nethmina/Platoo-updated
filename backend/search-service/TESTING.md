# Search Service - Testing Guide

Automated coverage for the search service. Suites are split by test scope so
they stay fast and deterministic.

## Suite layout

| Command | Scope | Needs running service? |
| --- | --- | --- |
| `npm test` / `npm run test:unit` | Unit tests (`tests/unit`) | No |
| `npm run test:integration` | HTTP + real Express app + in-memory MongoDB (`tests/integration`) | No |
| `npm run test:perf` | k6 load script (`tests/perf/search-load.js`) | Yes (localhost:3002) |
| `npm run test:whitebox` | Pre-existing white-box suite (`tests/whitebox`) | No |
| `npm run test:blackbox` | Pre-existing black-box suite (`tests/blackbox`) | Yes (localhost:3002) |
| `npm run test:security` | ESLint security plugins + `npm audit` | No |

## How to run

```bash
cd backend/search-service
npm install              # first time only
npm test                 # unit tests
npm run test:integration # HTTP integration against mongodb-memory-server
npm run test:perf        # requires k6 + running service
npm run test:whitebox
npm run test:blackbox    # requires the service running on 3002
```

## What is mocked vs real

- **Unit tests**: `RestaurantModel.find`, `axios.get` and `searchMenuItems` are
  jest mocks. No Mongo connection, no HTTP to the external menu service.
  Assertions cover the exact `$regex` filters built for name / `location.tag` /
  cuisines, pagination skip + limit, the 2000ms query time cap, empty-result
  arrays, and 400/500 status branching.
- **Integration tests**: `mongodb-memory-server` provides a real MongoDB the
  Express app queries over the wire via supertest. Restaurants are seeded into
  the same mongoose instance. The menu-service-backed routes
  (`/api/menu-items`, `/api/categories`) are NOT exercised here - they depend on
  the external menu service and are covered in unit tests via a mocked `axios`.
- **Perf tests**: k6 sends real requests to a running instance.

## Cases covered

- Validation: no params -> 400 JSON (no stack trace); NoSQL operator objects
  (`query[$ne]`, `cuisine[$ne]`) -> 400 (SRCH-01 / CWE-943).
- Restaurant search: case-insensitive name match, partial match, exact location
  + cuisine narrowing, empty result -> 200 with `[]` (not an error), pagination
  limit respected, huge limits clamped to 100 (SRCH-03 / CWE-770), regex
  metacharacters escaped so they never crash (SRCH-02 / CWE-1333).
- Menu-item search: 400 without query; delegates to `searchMenuItems` which
  queries the menu service with `params.query` and exact-matches case
  insensitively; 500 on upstream error.
- Category search: 400 without query; exact (case-insensitive) name match vs
  menu-service categories; 404 when no category matches; 500 on upstream error.
- Sanitise helpers: direct coverage of `sanitizeSearchParam`,
  `sanitizePlainText`, `sanitizePagination` (defaults + clamping).
- Hardening: unknown routes -> JSON 404, security headers present,
  `X-Powered-By` removed.

## k6 results (not committed)

Run locally and record in your report:

```bash
npm run test:perf
```

The script rotates realistic and adversarial queries (unicode, regex
metacharacters) and ramps from 10 to 80 VUs so you can eyeball the saturation
point. Checks assert "never 500", JSON responses and no leaked stack traces.

## Coverage gaps / known behaviours

- **`location` filter mismatch (latent bug)**: the controller builds a
  `location.tag` dot-path regex, but the `Restaurant` schema declares
  `location: String`. Plain-string documents therefore never match a location
  filter. The endpoint still returns 200 `[]` (never 500) - see the dedicated
  integration test documenting this gap. If restaurant docs ever store
  `location: { tag }`, remove that test and assert the narrowed result.
- **External dependency**: `/api/menu-items` and `/api/categories` call the
  menu service (`MENU_SERVICE_URL`, default localhost:3001). They are only
  unit-tested here; full E2E coverage needs the menu service running.
- **Rate limiting**: the global limiter (default `RATE_LIMIT_MAX=20`/min/IP)
  also applies to this suite's traffic; integration tests raise the limit via
  env before the app is imported.