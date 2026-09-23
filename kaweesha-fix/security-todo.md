# Security Fix Todo List — Platoo

Actionable todo list derived from [`vulnerability-assessment.md`](./vulnerability-assessment.md).
Boxes marked `[x]` are already addressed by the Google-auth and form-validation work plus the
V-01 admin-credential, V-02 role-guard, V-03 server-side-payment, V-07 server-side-pricing, and
V-05 payment-verification fixes (see [`kaweesha.md`](./kaweesha.md)); everything else is
outstanding.

Legend: Critical → do first · High → next · Medium → then · Observations → hardening backlog.

---

## Critical

- [x] **V-01 — Remove hardcoded admin credentials** (`seed-admin.js:6-7`)
      Done: `seed-admin.js` now requires `ADMIN_PASSWORD` from the environment or
      generates a strong random password (logged once, never committed).
      `ADMIN_EMAIL` / `ADMIN_RESET_PASSWORD=1` allow overriding the email and
      rotating an existing admin password. See `kaweesha.md`.

- [x] **V-02 — Prevent unauthenticated self-role-assignment on register** (`authController.ts:14,31`)
      Done: server-side whitelist (`PUBLIC_REGISTRATION_ROLES`) allows customer, restaurant owner,
      and delivery person to pick their own role; any `admin`/unknown role is downgraded to `user`.
      Mongoose enum validator already present. See `kaweesha.md`.

- [x] **V-03 — Recompute payment amount server-side** (payment-service `StripeService.java:23`)
      Done: `ProductRequest` now carries an `orderId` reference instead of an `amount`;
      the frontend persists the order before checkout and the payment-service recomputes the
      total from the stored order (`sum(price*qty) + delivery_fee`) before charging Stripe.
      Client-supplied monetary values are never used. See `kaweesha.md`.
      Made fully trustworthy by **V-07** (server-side order pricing) + **V-05**
      (server-side payment verification below).
      **Extended (2026-09-22):** `StripeService.computeTrustedAmount` now adds `order.path("tax")`,
      so the Stripe charge equals the stored payable `(subtotal + delivery_fee + tax)`.

- [x] **V-04 — Add authentication to order-service** (all routes `orderRoutes.ts`, `app.ts:17`)
      **Done (this session, with V-12):** `order-service/middleware/authenticate.ts` provides
      `protect(roles?)` (verifies the user-service JWT using the shared `JWT_SECRET`), an
      internal-service bypass via `x-internal-key`, and `isOwnerOrPrivileged(req, ownerUserId)`.
      **Completed wiring:**
      1. Every route in `orderRoutes.ts` now runs `protect(...)`; `GET /orders` is restricted to
         privileged roles (`admin`, `restaurant_owner`, `delivery_man`).
      2. Object-level authorization added in the controllers: `createOrder`/`updateOrder` take the
         caller's id from the verified JWT (body `user_id` ignored), `getOrderById`, `deleteOrder`,
         `confirmPaymentHandler`, and `getOrdersByUserId` all enforce `isOwnerOrPrivileged`.
      3. `JWT_SECRET` (same value as user-service) + `INTERNAL_SERVICE_KEY` added to
         `order-service/.env`/`.env.example` and `payment-service/.env`/`application.properties`.
      4. payment-service sends `x-internal-key` when fetching an order (`StripeService.fetchOrder`),
         so its V-03 amount recompute keeps working now that `GET /orders/:orderId` is protected.
      5. All ~20 frontend callers of order-service (checkout, payment-success, order-confirmation,
         orders, orders/history, admin *, restaurant *, delivery-dashboard, pending-deliveries) now
         send `Authorization: Bearer <token>`. Customer orders page switched from `GET /orders`
         (client-side filter) to the IDOR-guarded `/orders/history/:userId` (V-12).
      **Residuals (tracked):** tokens in `localStorage` → **resolved by V-08** (BFF cookie); the
      privileged `GET /orders` listing → **scoped 2026-09-23** (restaurant-owner sees only own
      restaurants' orders, delivery sees only pipeline statuses — see "Residuals closed" below);
      `delivery_fee` client-supplied → **resolved 2026-09-22** (recomputed server-side in
      `computeTotals`, see `trust-boundary-audit.md`).

---

## High

- [x] **V-05 — Verify Stripe payment before creating the order** (`payment-success/page.tsx:10-43`)
      Done (adapted to the V-03 flow, where the order now exists before payment as the
      checkout reference): the success page parses `session_id` and calls
      `PATCH /api/orders/{orderId}/payment`; the order-service verifies the session server-side
      through payment-service (→ Stripe), requires the Stripe metadata `order_id` to match the
      order, marks the order `paid`, and sends the confirmation email only then.
      Idempotent; failures → redirect to checkout; `localStorage` alone is never trusted.

- [x] **V-06 — Stop leaking password hashes** (`authController.ts:149-161,164-191,197-221`,
      `auth.ts:46-55`)
      **DONE (2026-09-22):** `GET /api/auth/users` now requires `admin`/`restaurant_owner`
      (`protect`), `GET /api/auth/user/:userId` requires any authenticated role, and
      `GET /api/auth/restaurant-owner/:userId` stays public. Every controller response excludes the
      hash: `getAllUsers`/`getUserById` use `.select('-password')`, `getRestaurantOwnerByIdPublic`
      returns only safe fields, and `updateUser` returns `toSafeUser(user)` (also strips
      `googleId`). Verified: no `password` field in any response; `/users` answers 401 anonymous /
      403 for non-privileged / 200 for admin+owner. Frontend caller that lacked a token
      (`restaurant/orders/page.tsx` `/users` fetch) now sends `Authorization: Bearer`.

- [x] **V-07 — Use server-side prices for order totals** (order-service `orderService.ts:22-23,124`)
      Done: menu-service exposes `POST /api/menu-items/quote` (server-side prices + invalid-id
      detection) and order-service `createOrder`/`updateOrder` build items/totals exclusively from
      those trusted prices, rejecting orders with any missing/invalid item.
      Residual (tracked in audit): `delivery_fee` client-supplied (see
      `trust-boundary-audit.md`) — **RESOLVED (2026-09-22)**: order-service now resolves the
      payable fee server-side from the restaurant record via
      `GET menu-service /api/restaurants/:id`; the client `delivery_fee` is kept only as a
      display hint (`parseDeliveryFee`) and no longer feeds the totals. Client-supplied
      `total_amount`/`tax`/`status`/`user_id` are stripped or rejected.

- [x] **V-12 — Stop exposing all orders without auth** (`orderRoutes.ts:20-30`,
      `orders/page.tsx:39-47`)
      **Done (with V-04, this session):** `GET /api/orders` is protected and restricted to
      privileged roles (customers get 403); `GET /api/orders/history/:userId` now requires the
      `:userId` param to match the JWT subject (IDOR-guarded); the customer orders page now calls
      the history endpoint instead of filtering the full collection client-side. Residual: the
      privileged-role listing still returns all orders to every admin/restaurant-owner/delivery
      person (see V-04 residual note).

---

## Medium

- [x] **V-08 — Move JWT out of localStorage (XSS-accessible)** (`login/page.tsx:77`,
      `useUserContext.tsx:79`)
      **DONE (2026-09-23):** BFF session cookie — the JWT is written to an HttpOnly
      `SameSite=Lax` cookie by server-only `/api/auth/login|google` handlers and never returned to
      browser JS. Client pages keep only non-secret role/id identity keys. A same-origin allowlisted
      proxy (`/api/proxy/{user,order,pay}/*`) and `/api/auth/session` (→ user-service
      `GET /api/auth/me`) attach/validate the cookie server-side. `"jwtToken"` vs `"token"` key
      duplication removed — grep audit shows **no** JWT reads remain in client code.

- [x] **V-09 — Stop leaking raw error messages in 500s** (user-service, order-service,
      payment-service)
      Return generic messages to clients; log details server-side only. Do not relay
      `StripeException.getMessage()`.
      **DONE (2026-09-22):** order-service, user-service, and menu-service `app.ts` central
      generic 404/500 handlers (no `error.message`/Mongo strings — order-service has a dedicated
      no-leak test); user-service `authController` error paths all return generic messages (and no
      longer logs passwords on register); payment-service `ProductCheckoutController` returns
      generic `400`/`500` bodies (`Invalid checkout request` / generic session error) and
      `PaymentVerificationController` never relays `StripeException.getMessage()`. All
      controller/service errors are logged server-side only.

- [ ] **V-10 — Restrict CORS on user-service** (`app.ts:8`)
      `app.use(cors({ origin: 'http://localhost:3000', credentials: true }))` (allowlist for prod).
      **DONE (2026-09-22):** CORS is restricted from an `CORS_ORIGINS` env allowlist
      (`services/*/app.ts` + `.env.example`), defaulting to
      `http://localhost:3000,http://127.0.0.1:3000` — so dev keeps working and a future prod
      just points the env var at the real origins.

- [x] **V-11 — Don't return the password hash from updateUser** (`authController.ts:98`)
      **DONE (2026-09-22):** `updateUser` responds with `toSafeUser(user)` (password + googleId
      stripped) and now also enforces the same 8-128 + complexity password policy on `newPassword`,
      returning a `400` without mutating the account on weak input.

---

## Additional observations (Section 5)

- **Trust-boundary audit** — see [`trust-boundary-audit.md`](./trust-boundary-audit.md)
      (user/payment/order services). Verdict: items/total/amount are server-verified
      (V-03+V-05+V-07 ✅), roles whitelisted (V-02 ✅), order-service fully authenticated with
      ownership checks (V-04+V-12 ✅); **remaining client-authoritative data**: the privileged
      `GET /orders` listing (restaurant-owner/delivery dashboards still filter client-side —
      legit paths need owner/assignment mapping), and `delivery_fee` stored verbatim then fed into
      the payment total (the restaurant record already carries `deliveryFee` server-side — resolve
      it instead of trusting the client) — **resolved 2026-09-22: the payable fee, tax, and totals are
      all recomputed in order-service (`computeTotals`) from the menu quote + restaurant record.**

- [x] **Committed third-party API key (frontend)** — `components/dashboards/delivery-dashboard.tsx:105`
      hardcodes an OpenRouteService direction API key as `Authorization`. An extra credential is now
      exposed in the repo and browser bundle. **RESOLVED (2026-09-22):** the key is no longer in
      source — the component reads `process.env.NEXT_PUBLIC_ORS_API_KEY` (documented in
      `frontend/platoo-client/.env.local.example`); routing degrades gracefully if it is unset.
      **Action still required:** the old key is in the commit history → rotate/revoke it in the
      OpenRouteService console; prefer a server-side/BFF proxy for the real key later.

- [x] **Backend password-strength validation** — register endpoint currently does not
      enforce strength server-side (frontend does; mirror it on the server).
      **DONE (2026-09-22):** `authController.register` mirrors the frontend policy — 8-128 chars
      with uppercase, lowercase, a digit and a special character (rejects with `400`), and validates
      email format. Also removed the `req.body` (password-including) register log.

- [x] **Login rate limiting / account lockout / CAPTCHA** — `/api/auth/login` has no
      throttling → brute force is practical. Add rate limiting, lockout, or CAPTCHA.
      **Rate limiting DONE (2026-09-22):** user-service now enforces a global 500/15min limiter
      plus a stricter auth limiter (20/10min on register/login), env-tunable via `RATE_LIMIT_*`.
      Lockout/CAPTCHA still open (smaller residual).

- [x] **JWT hardening** — shorter expiry and/or refresh-token mechanism is a design decision;
      **token revocation/blacklist resolved (2026-09-23)** so logout actually invalidates tokens
      (server-side blacklist + cross-service introspection — see "Residuals closed" below).

- [x] **Dependency audit remediation (user-service)** — `npm audit`: express, mongoose
      (NoSQL `$nor` sanitizeFilter bypass, prototype pollution), jws, path-to-regexp,
      qs, minimatch, brace-expansion, picomatch, diff (10 vulnerabilities).
      **DONE (2026-09-23):** `npm audit fix` → **0 vulnerabilities** (audited tree clean).

- [x] **Dependency audit remediation (order-service)** — `npm audit`: axios (many),
      mongoose, nodemailer, form-data (critical), lodash, sequelize, validator, etc.
      (23 vulnerabilities).
      **DONE (2026-09-23):** `npm audit fix` → **0 vulnerabilities**; removed unused
      `sequelize`/`sequelize-cli`; `nodemailer` upgraded 6.x → patched 10.x (the order
      confirmation email path still works).

---

## Operational / build fixes (done — not security findings, for completeness)

- [x] **payment-service missing from `start-all.sh`** — the launcher ran every Node backend
      service but never booted payment-service (`:8081`), so checkout always returned
      "Payment session failed." Added a `mvn -o spring-boot:run` block that sources
      `payment-service/.env` first (Spring Boot does **not** auto-load `.env`, so
      `STRIPE_SECRET_KEY` must be exported). See `start-all.sh:99-117`.
- [x] **Cart page logged `AxiosError 404` for new users** — `cart-service` `getCartByUserId`
      returned 404 when a user had no cart yet, and the frontend treated that as failure.
      Now returns `200` with an empty cart. See `cartController.ts:getCartByUserId`.

- [x] **payment-service deps (partial)** — **OWASP dependency-check installed** in `pom.xml`
      (plugin `org.owasp:dependency-check-maven:10.0.4`, opt-in goal, `failBuildOnCVSS=8`).
      **DONE (2026-09-23):** `stripe-java` bumped 24.3.0 → **24.24.0** (latest 24.x) and the
      service rebuilt/verified under **JDK 17**. The unused `spring-boot-starter-thymeleaf`
      remains (cosmetic; no advisory on the runtime path).

- [x] **NoSQL injection hygiene (order-service)** — keep user input out of Mongo
      operators (`$nor`, `$or`, …) and upgrade mongoose past the sanitizeFilter bypass CVE.
      **DONE (2026-09-23):** new `rejectNoSqlOperators` middleware rejects `$`-prefixed keys/values
      and dot-notation keys in order- and user-service params/query/body up front; mongoose is on
      the patched 8.13 line (audit-clean).

---

## Runtime observations (2026-09-20, live smoke test)

- **Checkout → `400` on `POST /api/orders`** → **RESOLVED** (this session). Two-stage root cause,
      now fixed and verified end-to-end:
      1. `restaurant_id: undefined` — `orderNow` in `restaurants/[id]/page.tsx` stored
         `selectedItem`/`selectedQuantity` but never `restaurantId`, so checkout's
         `restaurant?._id` was `undefined`. Fixed by persisting `restaurantId` before the
         `/checkout` navigation (`restaurants/[id]/page.tsx`).
      2. `menu_item_id: "undefined"` → `"Invalid menu items in order"` — cart items are stored
         with a `menuItemId` key (remapped in `useCart.ts:38` / cart page, which drops
         `productId`), but checkout built `menu_item_id: item.productId`, which serialized as
         `undefined` and was rejected by `order-service` → menu-service quote. Fixed in
         `checkout/page.tsx`: `itemsToSend` now resolves the id via
         `menuItemId ?? productId` (cart) / `_id ?? productId ?? menuItemId` (single item) and
         coerces `quantity` with `Number()`.
      Diagnostic aid added (kept, harmless): `orderController.ts` 400 now returns a `failed`
      array naming the exact missing/incorrect field, and `orderService.ts` 500 includes the
      rejected `menu_item_id`s — so any future rejections self-diagnose.

- **New-user "My Orders" page listed all orders** (`orders/page.tsx:39-47`) → **RESOLVED (this session)**
      — the page fetched `GET /api/orders` and filtered client-side. Now it calls
      `GET /api/orders/history/:userId` with `Authorization: Bearer`, and the backend enforces
      token→`:userId` matching (V-12).

- **payment-service now boots via `start-all.sh`** (fixed this session) — sourced
      `payment-service/.env` for `STRIPE_SECRET_KEY` (Spring Boot does not auto-load `.env`).
      Verified a checkout session is created without the former "Payment session failed" error.

- **cart-service empty-cart 404** (fixed this session) — `GET /api/cart/:userId` returns
      `200 []` for a brand-new user's empty cart instead of 404 (the 404 was thrown as an
      `AxiosError` and treated as failure by the cart page).

---

## Order / checkout hardening — 2026-09-22 (see root `SECURITY.md`)

This session hardened the order + checkout trust boundary end-to-end. Every item below is
implemented **and** verified (security suite 12/12, `npx tsc --noEmit` for the three Node
services, `mvn -o -q compile` for payment-service, live Stripe checkout session):

- **Server-side money** — order-service `computeTotals` derives subtotal (menu quote), payable
  fee (restaurant record), tax 8%, and total; client `total_amount`/`delivery_fee`/`tax`/
  `status`/`user_id` are stripped (create) or rejected with a `failed[]` list (update).
- **Joi validation** — `validators/order.schemas.ts`: ObjectId patterns (kills NoSQL/`$`/`.`/
  quotes), quantities 1–99, ≤50 items/order, address/phone/email/lat-lng checked; server-owned
  fields forbidden.
- **Idempotency** — `Idempotency-Key` header → `201` first time, `200 { idempotent:true }` on
  replay (same `_id`); partial unique index `{ user_id, idempotency_key }` + E11000 handling in
  a transaction races safe. Frontend sends `crypto.randomUUID()` reused until success.
- **Rate limiting** — global 500/15min + order-create 30/min (order-service); global + auth
  20/10min (user-service). `RateLimit-Policy` header on order routes.
- **Transport hardening** — `helmet`, CORS env allowlist, 32 KB body limits, central generic
  404/500 handlers (order/user/menu).
- **Ownership/role scoping** — controllers verify JWT subject vs `user_id`, status changes are
  staff-only, restaurant owners only touch their restaurant's orders.
- **Test suite** — `backend/order-service/tests/security/order-security.test.ts`
  (`npm run test:security`, 12 cases incl. mass-assignment, IDOR, replay, rate limit).
- **Live demo** — [`demo-security.sh`](./demo-security.sh) covers user-service,
  order-service, and payment-service with real requests. **38/38 PASS on live stack**
  (2026-09-23). Slides: (1) user-service auth/role checks, (2) no-hash leaks,
  (3) order-service auth/IDOR, (4) idempotency, (5) payment no-leak, (6) transport
  (helmet/CORS/CORP), (7) Stripe checkout, (8) V-14 residuals (role-scoped listing +
  revocation), (9) rate limiting (last, so it can burn the order budget safely).
  Run `bash kaweesha-fix/demo-security.sh` (auto-cleans demo data; add `--keep` to keep it).

**Operational lesson (this session):** re-running `start-all.sh` leaves one `nodemon`/
`ts-node-dev` watcher behind **per run**; several watchers then fight over the same port and
serve stale code intermittently. Kill all matching processes
(`pkill -f backend/order-service`, etc.) before starting a clean instance — and don't re-run the
security suite twice inside one order-limiter window (the 30/min budget is shared per-IP), or
restart user-service to refresh the auth budget.

---

## Residuals closed — 2026-09-23

The last open backend residuals from the audit are now implemented **and** verified live:

- **Privileged `GET /orders` is now role-scoped** — `order-service`:
  - `admin`/internal (`x-internal-key`): full list, optionally filtered by `?restaurant_id=`;
  - `restaurant_owner`: only orders for **their own** restaurants — order-service maps
    owner→restaurants server-side (`getRestaurantsByOwnerId` via the menu-service restaurant
    list, filtered by `owner_id`) and 403s if a requested `restaurant_id` is not theirs;
  - `delivery_man`: only `['preparing','ready','delivered']` (their pipeline), so customer
    carts/pending orders are never visible;
  - anything else → `403`.
  Verified live: owner with no restaurants → `0`; after transferring a restaurant to a test
  owner → exactly its `N` orders; non-owned `restaurant_id` → `403`; delivery user → `0`
  (pending carts hidden); internal key → full list.
  *Note:* menu-service's `GET /:restaurantId` shadows `GET /owner/:ownerId` (pre-existing
  route-ordering in the other member's service) — unmodified; the owner mapping uses the list endpoint.
- **Server-side JWT revocation / blacklist** — `user-service`:
  - new `TokenBlacklist` model (`tokenHash` unique + TTL index), `POST /api/auth/logout`
    (protected) upserts a blacklist entry (1-day TTL), the async `protect` fails closed with
    `401 "Unauthorized: Token revoked"`, and a new protected `GET /api/auth/verify`
    (`{valid,user:{id,role}}`) exposes introspection.
  - `order-service` `authenticate.ts` (`protect`) is now async and, when
    `JWT_INTROSPECT_URL` is set (`backend/order-service/.env`, documented in `.env.example`),
    verifies **every request** against user-service `/api/auth/verify` — a revoked token is
    rejected cross-service (network failure also fails closed → 401).
  - `frontend/platoo-client/app/api/auth/logout/route.ts` — BFF logout posts the bearer token
    to user-service `/logout` (revoking it server-side) before deleting the `platoo_token`
    cookie; `components/dashboards/restaurant-dashboard.tsx` sign-out now POSTs (was a GET →
    405).
  - Verified live: `verify 200 → logout 200 → verify 401 → /me 401`, and order-service history
    with the revoked token → `401 "Unauthorized: Token revoked"`.
- **user-service auth limiter scoped** — the strict limiter previously covered the whole
  `/api/auth` path, throttling bearer-token routes (`/me`,`/verify`,`/logout`) and breaking
  order-service introspection (429s). It now applies only to
  `/api/auth/login|register|google`.
- **`stripe-java` upgraded** 24.3.0 → 24.24.0; payment-service recompiled and re-verified
  under JDK 17 (class file v61).
- **Final verification:** demo suite **38/38 PASS** (incl. revocation + rate-limit slides),
  order-service security suite 12/12, `tsc` clean on user/order, `next build` clean; BFF
  cookie logout flow verified end-to-end (register → login → session → logout → 401).

**Still manual-only (external):** rotate/revoke the old OpenRouteService key in the ORS
console (see V-13 note above). Everything else in the audit is code-verified.

---

## Suggested order of attack

1. V-01 ✅, V-02 ✅, V-04 ✅ (auth + role hardening) — everything else depends on auth working.
2. V-06, V-11 (stop hash leakage) + V-09 pattern everywhere.
3. V-05 ✅, V-07 ✅, V-03 ✅ (payment/order trust) — V-12 ✅ with V-04.
4. V-08, V-10 (frontend/token storage + CORS).
5. Dependency upgrades + rate limiting, in parallel with the above.