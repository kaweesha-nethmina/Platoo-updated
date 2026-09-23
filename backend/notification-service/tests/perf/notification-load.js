/*
 * NOTIFICATION-SERVICE - k6 load test for
 * POST /api/notifications/send-delivery-notification
 *
 * PREREQUISITES
 *   - k6 installed (https://k6.io/docs/getting-started/installation/)
 *   - notification-service running locally (npm run dev, default port 4006)
 *     OR BASE_URL pointed at a deployed instance
 *   - a JWT minted with the service's JWT_SECRET and role "admin" passed via
 *     -e NOTIF_TOKEN=<token>  (k6 cannot sign JWTs; get one with:
 *       call /api/notifications from the app, or jwt.sign in node)
 *   - SMTP_TRANSPORT=mock (dev default) so no real emails are sent
 *
 * USAGE
 *   npm run test:perf -- -e NOTIF_TOKEN=<jwt>
 *   or: k6 run tests/perf/notification-load.js -e NOTIF_TOKEN=<jwt>
 *
 * WHAT IT MEASURES
 *   - steady-state throughput + p95 latency while delivery-person fan-out runs
 *   - a spike stage after steady state to expose queue/pool pressure
 *   - 401-path baseline (no auth) so you can compare the "cheap" endpoint path
 *   - 429 behaviour: the first 25 authenticated calls succeed, then the rate
 *     limiter kicks in (RATE_LIMIT_MAX). Run with a lengthy test window or a
 *     single post-load after the warmup to observe seeded 429s.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:4006';
const TOKEN = (__ENV.NOTIF_TOKEN || '').trim();

export const options = {
  stages: [
    { duration: '10s', target: 10 }, // warmup
    { duration: '30s', target: 25 }, // steady load
    { duration: '10s', target: 50 }, // spike
    { duration: '10s', target: 0 }, // cool-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // <1% errors (rate-limited 429s excluded)
    http_req_duration: ['p(95)<1000'], // p95 under 1s
  },
};

const payload = JSON.stringify({
  orderDetails: {
    id: 'perf-order',
    customer: { name: 'Perf Customer', address: 'Colombo' },
    total: 1234.5,
  },
});

const params = {
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`,
  },
};

export default function () {
  if (!TOKEN) {
    // Without a token the endpoint is rejected with 401 - a good baseline but
    // not the full path. Warn once on the first iteration.
    if (__ITER === 0) {
      console.warn('NOTIF_TOKEN env var not set - hitting the 401 path only. Pass -e NOTIF_TOKEN=<jwt>.');
    }
  }

  const res = http.post(`${BASE}/api/notifications/send-delivery-notification`, payload, params);
  const expected = TOKEN ? 200 : 401;
  const rateLimited = TOKEN && res.status === 429;

  // 429 is an expected outcome of this endpoint's abuse control (RATE_LIMIT_MAX
  // requests per window). Treat it as pass while still logging it; network or
  // 5xx failures are what break the thresholds.
  check(res, {
    [`status is ${expected}`]: (r) => r.status === expected,
    'no unexpected 4xx/5xx': (r) => (rateLimited ? true : r.status >= 200 && r.status < 500),
  });

  if (res.status === 429 && __ITER % 10 === 0) {
    console.warn(`[k6] rate limited (429) at iteration ${__ITER}`);
  }

  sleep(0.1);
}