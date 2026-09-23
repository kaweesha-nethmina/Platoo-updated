# Security Hardening — Platoo (Order / Checkout flow)

Hardening pass over the **order + checkout** trust boundary: server-side pricing,
idempotency, rate limiting, generic error handling, and an automated security test suite.
Implemented on 2026-09-22 and verified end-to-end.

## Trust model (what a client can no longer control)

| Field | Before | After |
|---|---|---|
| Item prices / subtotal | client-supplied `total_amount` | recomputed in order-service via menu-service quote (server prices) |
| `delivery_fee` | client-supplied number | stored as client display hint, **payable fee resolved server-side from the restaurant record** (`menu-service /api/restaurants/:id`) |
| `tax` | none | added server-side (`TAX_RATE 0.08`) — line item in the order **and** included in the payment-service recompute |
| `status`, `user_id`, `total_amount` | client-writable | forbidden fields — silently stripped (`createOrder`) or rejected with `400` + a `failed[]` list (PUT path) |
| quantities | any | Joi `1..99`, max 50 items per order |
| payment amount | `amount` from client | stripe-service fetches the order via `x-internal-key` and recomputes `sum(price*qty) + delivery_fee + tax` |

## Controls

- **AuthN/AuthZ** — every order-service route runs `protect(roles?)` (shared-JWT verify against
  the user-service `JWT_SECRET`); internal service-to-service calls use `x-internal-key`.
  Ownership enforced in controllers (`isOwnerOrPrivileged`); order-status changes are
  staff-only and a restaurant owner can only touch their own restaurant's orders. user-service
  `GET /users` and `GET /user/:userId` are now authenticated (privileged / any-authenticated
  respectively) and **no endpoint ever returns a password hash** (`.select('-password')` /
  `toSafeUser()`).
- **Idempotency** — `POST /api/orders` honors an `Idempotency-Key` header. The frontend sends a
  UUID (reused until success). A replay returns `200` + `{ idempotent: true }` with the *same*
  order; duplicate keys are rejected even in racing requests via a partial unique index
  `{ user_id, idempotency_key }` + E11000 handling inside a transaction.
- **Route hardening** for order-, user-, and menu-service `app.ts`: `helmet`, CORS restricted to
  an `CORS_ORIGINS` env allowlist (default `http://localhost:3000,http://127.0.0.1:3000`),
  32 KB JSON body limit, central generic 404/500 handler (no `error.message` / DB strings
  relayed to clients).
- **Rate limiting** — global 500 / 15 min (order + user), order-create 30 / min, auth
  (register/login) 20 / 10 min. Tunable via `RATE_LIMIT_*` env vars. Every response carries the
  `RateLimit-*` headers.
- **Credential hygiene** — registration/`updateUser` enforce a server-side password policy
  (8–128 chars, upper/lower/digit/special) mirroring the frontend; the register log never
  contains passwords; the one-time OpenRouteService key is no longer hardcoded in the bundle
  (`NEXT_PUBLIC_ORS_API_KEY`, see `frontend/platoo-client/.env.local.example`).
- **NoSQL-injection hygiene** — `menu_item_id` must match the Mongo ObjectId pattern; quoted
  strings and example "NoSQL" payloads are rejected. Auth/payment/order ids are validated.
- **XSS-in-transit** — user-supplied text (address, notes) is stored verbatim and React renders
  it escaped; the checkout payload is strict so no markup can reach the order data.
- **Payment** — `StripeService.computeTrustedAmount` derives the chargeable amount from the
  persisted order (items + fee + tax). Checkout accepts only an `orderId` reference, never an
  amount.

## Test suite

`backend/order-service/tests/security/order-security.test.ts` — 12 cases run against a live
stack (order + user + menu services up):

```bash
cd backend/order-service && npm run test:security
# TS_NODE_TRANSPILE_ONLY=1 node -r ts-node/register --test  tests/security/order-security.test.ts
```

Coverage: 401 without auth; client prices ignored; mass-assignment rejected; IDOR read/update/
delete blocked; invalid quantity; malformed/NoSQL `menu_item_id`; forbidden-field 400
**before** any price computation; no internal-error leakage; XSS stored-then-render-safe;
meaningful 404; idempotent replay (`201` → `200 idempotent:true`, same `_id`); rate-limit 429.

**Operational notes for running it**
- Start one clean copy of each service (see `start-all.sh`). Do **not** restart `start-all.sh`
  repeatedly while testing: it accumulates a new `nodemon`/`ts-node-dev` watcher per run and the
  watchers fight over the port, intermittently serving stale code.
- The order limiter (30/min) and auth limiter (20/10min) are shared per-IP budgets. Re-run the
  suite only after a fresh order window (~60s) and (if you hit 429) restart user-service for a
  fresh auth budget. The rate-limit case runs last by design.
- The suite cleans up its test orders/users; the order `counter` is kept above existing ids
  (do not reset it to 0 — that recreates `order_id` duplicate-key errors).

## Residuals (tracked, not in scope)

- `menu-service` CRUD endpoints remain unauthenticated (they are the server-side price source);
  expose them to trusted services only in production — protecting the write routes requires the
  frontend dashboards + order-service to send credentials first.
- `GET /api/auth/user/:userId` is authenticated but not per-role IDOR-scoped: any signed-in user
  can read another user's profile card (admin/owner/delivery flows legitimately need this; add
  explicit role rules in production).
- JWT expiry/refresh-token mechanism not yet chosen (server-side **revocation** is shipped:
  `TokenBlacklist` + `POST /api/auth/logout` + order-service introspection via
  `JWT_INTROSPECT_URL`).
- Old committed OpenRouteService key still needs **revocation in the ORS console** (user action).

Closed residuals (2026-09-23): `GET /api/orders` is now role-scoped server-side
(restaurant-owner → own restaurants, delivery → pipeline statuses, `403` on non-owned ids);
tokens moved out of `localStorage` into the HttpOnly BFF cookie (V-08); dependency audits are
clean (user/order `0` vulnerabilities, `stripe-java` 24.24.0 under JDK 17).

Verified end-to-end on 2026-09-22/23: `npx tsc --noEmit` (order/user/menu), `mvn -o -q compile`
(payment), suite 12/12, demo **38/38**, and a live checkout produced a real Stripe Test session
for an order whose stored payable was `subtotal + fee + tax`.