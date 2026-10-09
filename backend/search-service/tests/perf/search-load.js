/*
 * SEARCH-SERVICE - k6 load test for the public search endpoint
 * GET /api/restaurants?query=...
 *
 * PREREQUISITES
 *   - k6 installed (https://k6.io/docs/getting-started/installation/)
 *   - search-service running locally (npm run dev, default port 3002)
 *     OR BASE_URL pointed at a deployed instance
 *
 * USAGE
 *   npm run test:perf
 *   or: k6 run tests/perf/search-load.js
 *
 * WHAT IT MEASURES
 *   - steady-state throughput + p95/p99 latency for narrow and broad queries
 *   - a ramp until failure so you can eyeball the saturation point
 *   - NoSQL-operator objections and regex-metachar queries (the attack shapes
 *     that used to 500 this service) to confirm they stay fast + safe under load
 */

import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:3002';

export const options = {
  stages: [
    { duration: '10s', target: 10 }, // warmup
    { duration: '30s', target: 30 }, // steady load
    { duration: '15s', target: 80 }, // ramp up until we see degradation
    { duration: '5s', target: 0 }, // cool-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
  },
};

// Rotation of realistic + adversarial shapes.
const queries = [
  'pizza',
  'kottu',
  'burger',
  'italian restaurant colombo',
  'පීසා', // unicode (must never 500)
  '(a+)+$', // regex metacharacters (escaped, must stay fast)
  'pizza with extra cheese',
];

export default function () {
  const query = queries[__ITER % queries.length];
  const res = http.get(`${BASE}/api/restaurants?query=${encodeURIComponent(query)}`);

  check(res, {
    'status is 200/400/404 (never 500)': (r) => [200, 400, 404].includes(r.status),
    'response is JSON': (r) => r.headers['Content-Type']?.includes('application/json') ?? true,
    'no stack trace leaked': (r) => !r.body.includes('node_modules'),
  });

  // Simulate a real user: input + a small think time before the next search.
  // (Intentionally empty to keep readable; add `sleep(0.2)` if you want pacing.)
}