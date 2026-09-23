# Notification Service - Testing Guide

Automated coverage for the notification service. Suites are split by test scope
so they stay fast and deterministic.

## Suite layout

| Command | Scope | Needs running service? |
| --- | --- | --- |
| `npm test` / `npm run test:unit` | Unit tests (`tests/unit`) | No |
| `npm run test:integration` | HTTP + real Express app + in-memory MongoDB (`tests/integration`) | No |
| `npm run test:perf` | k6 load script (`tests/perf/notification-load.js`) | Yes (localhost:4006) |
| `npm run test:whitebox` | Pre-existing white-box suite (`tests/whitebox`) | No |
| `npm run test:blackbox` | Pre-existing black-box suite (`tests/blackbox`) | Yes (localhost:4006) |
| `npm run test:security` | ESLint security plugins + `npm audit` | No |

## How to run

```bash
cd backend/notification-service
npm install              # first time only
npm test                 # unit tests
npm run test:integration # HTTP integration against mongodb-memory-server
npm run test:perf -- -e NOTIF_TOKEN=<admin-jwt>   # requires k6 + running service
npm run test:whitebox
npm run test:blackbox    # requires the service running on 4006 WITH seeded delivery-man users
```

## What is mocked vs real

- **Unit tests**: `User.find` and `sendEmail`/`buildEmailMessage` are jest mocks;
  no Mongo, no SMTP. The recipient-cap test reloads the module with a pinned
  `MAX_NOTIFICATION_RECIPIENTS` because it is read at module load.
- **Integration tests**: `mongodb-memory-server` provides a real MongoDB
  instance the Express app connects to; delivery-man users are seeded through
  that same mongoose instance. The SMTP transport module is mocked
  (`createTransport -> { sendMail: jest.fn() }`), so **no real email is ever
  sent** even on the success path.
- **Perf tests**: point k6 at a real running instance. Use the default dev
  config (`SMTP_TRANSPORT=mock`) so fan-out uses Nodemailer's JSON transport
  and no real email goes out.

## Cases covered

- Auth gate: 401 no token / garbage token, 403 role outside
  admin/restaurant_owner (the `protect` middleware pins HS256 + required claims).
- Validation: missing/invalid `orderDetails` -> 400; oversized/CRLF fields are
  sanitised (`sanitizeEmailField` strips CRLF so email header injection is
  defeated).
- Service logic: one email per delivery man, per-email failure collection
  (partial failure still reports `delivered > 0`), full failure rethrows -> 500,
  empty recipient list throws, recipients without an email are skipped, and the
  `MAX_NOTIFICATION_RECIPIENTS` cap truncates fan-out (NOTIF-02).
- Success path: 200 with `{ success, message, delivered }`, `sendMail` called
  once per seeded delivery man.
- User model: required fields + four-role enum.

## k6 results (not committed)

Run locally and record in your report:

```bash
npm run test:perf -- -e NOTIF_TOKEN=$TOKEN
```

Important: the notification endpoint rate-limits after `RATE_LIMIT_MAX` (default
25) requests per window per `ip:userId`. Under load you will (correctly) see a
mix of 200 and 429 responses - the checks treat 429 as expected. To observe the
full path under sustained load without the limiter, restart the service with
`RATE_LIMIT_MAX=100000 RATE_LIMIT_WINDOW_MS=60000`.

## Coverage gaps / known behaviours

- **No notification history**: the service is fire-and-forget. There is no
  Notification model, receipt/read receipts, idempotency key, or persisted send
  log, so duplicate `orderDetails.id` POSTs re-send to every delivery person.
  There is a `tests/unit` User-schema test but no Notification entity to test.
- **Latency under fan-out**: `Promise.all` sends all emails concurrently; the
  true cost is the slowest recipient (S = max, serial = sum). No response awaits
  `sendMail` completion beyond the buffered promise pool used by Nodemailer.
- **Live black-box dependency**: `tests/blackbox` needs a running instance with
  at least one `delivery_man` user in the DB and a fresh rate-limit window
  (repeated runs within 60s can hit 429 on the last auth test).