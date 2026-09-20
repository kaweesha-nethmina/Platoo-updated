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

- [ ] **V-04 — Add authentication to order-service** (all routes `orderRoutes.ts`, `app.ts:17`)
      **Backend middleware is in place** — `order-service/middleware/authenticate.ts` provides
      `protect(roles?)` (verifies the user-service JWT using the shared `JWT_SECRET`), an
      internal-service bypass via `x-internal-key` header = `INTERNAL_SERVICE_KEY`, and
      `isOwnerOrPrivileged(req, ownerUserId)` for resource-ownership checks. **Still outstanding:**
      (1) wire `protect`/ownership onto *every* route in `orderRoutes.ts`; (2) share the same
      `JWT_SECRET` + `INTERNAL_SERVICE_KEY` in order-service and payment-service `.env` /
      `.env.example`; (3) have payment-service send `x-internal-key` when it fetches an order
      (`StripeService.fetchOrder`, verify flow); (4) add `Authorization: Bearer` to all frontend
      callers of order-service. Do not commit real secret values. Partially mirrored by the
      V-12 checklist item (ownership on `GET /orders/history/:userId`).

---

## High

- [x] **V-05 — Verify Stripe payment before creating the order** (`payment-success/page.tsx:10-43`)
      Done (adapted to the V-03 flow, where the order now exists before payment as the
      checkout reference): the success page parses `session_id` and calls
      `PATCH /api/orders/{orderId}/payment`; the order-service verifies the session server-side
      through payment-service (→ Stripe), requires the Stripe metadata `order_id` to match the
      order, marks the order `paid`, and sends the confirmation email only then.
      Idempotent; failures → redirect to checkout; `localStorage` alone is never trusted.

- [ ] **V-06 — Stop leaking password hashes** (`authController.ts:149-161,164-191,197-221`,
      `auth.ts:46-55`)
      Add auth middleware to `/users`, `/user/:userId`, `/restaurant-owner/:userId`;
      return users with `.select('-password')` (or a `toSafeJSON()` method).

- [x] **V-07 — Use server-side prices for order totals** (order-service `orderService.ts:22-23,124`)
      Done: menu-service exposes `POST /api/menu-items/quote` (server-side prices + invalid-id
      detection) and order-service `createOrder`/`updateOrder` build items/totals exclusively from
      those trusted prices, rejecting orders with any missing/invalid item.

- [ ] **V-12 — Stop exposing all orders without auth** (`orderRoutes.ts:20-30`,
      `orders/page.tsx:39-47`)
      Remove public `GET /api/orders` (or make it admin-only); protect
      `GET /api/orders/history/:userId` and verify `:userId` matches the JWT subject.
      Never rely on client-side filtering for authorization.

---

## Medium

- [ ] **V-08 — Move JWT out of localStorage (XSS-accessible)** (`login/page.tsx:77`,
      `useUserContext.tsx:79`)
      Use an `httpOnly` + `Secure` + `SameSite` cookie set by the server (or a BFF)
      instead of `localStorage`. Also consolidate the `"jwtToken"` vs `"token"` key duplication.

- [ ] **V-09 — Stop leaking raw error messages in 500s** (user-service, order-service,
      payment-service)
      Return generic messages to clients; log details server-side only. Do not relay
      `StripeException.getMessage()`.
      Partial: ✅ Google-auth endpoint and payment-service `verify-payment` already return
      generic errors (see `kaweesha.md`).

- [ ] **V-10 — Restrict CORS on user-service** (`app.ts:8`)
      `app.use(cors({ origin: 'http://localhost:3000', credentials: true }))` (allowlist for prod).

- [ ] **V-11 — Don't return the password hash from updateUser** (`authController.ts:98`)
      Exclude password via `.select('-password')` on the response.

---

## Additional observations (Section 5)

- [ ] **Backend password-strength validation** — register endpoint currently does not
      enforce strength server-side (frontend does; mirror it on the server).
      Partial: ✅ frontend register enforces 8+ chars + complexity (see `kaweesha.md`).

- [ ] **Login rate limiting / account lockout / CAPTCHA** — `/api/auth/login` has no
      throttling → brute force is practical. Add rate limiting, lockout, or CAPTCHA.

- [ ] **JWT hardening** — decide on shorter expiry and/or refresh-token mechanism;
      add token revocation/blacklist so logout actually invalidates tokens.

- [ ] **Dependency audit remediation (user-service)** — `npm audit`: express, mongoose
      (NoSQL `$nor` sanitizeFilter bypass, prototype pollution), jws, path-to-regexp,
      qs, minimatch, brace-expansion, picomatch, diff (10 vulnerabilities).

- [ ] **Dependency audit remediation (order-service)** — `npm audit`: axios (many),
      mongoose, nodemailer, form-data (critical), lodash, sequelize, validator, etc.
      (23 vulnerabilities).

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

- [ ] **payment-service deps** — update `stripe-java` (24.3.0 → latest 27.x+); drop
      unused `spring-boot-starter-thymeleaf`; run OWASP dependency-check.

- [ ] **NoSQL injection hygiene (order-service)** — keep user input out of Mongo
      operators (`$nor`, `$or`, …) and upgrade mongoose past the sanitizeFilter bypass CVE.

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

- **New-user "My Orders" page still lists all orders** (`orders/page.tsx:39-47`) — the page
      fetches `GET /api/orders` and filters client-side by `user_id`. This is the V-12 pattern
      (client-side filtering ≠ authorization); it also means the public `GET /api/orders` still
      returns the whole collection to any caller. Tracked under V-12.

- **payment-service now boots via `start-all.sh`** (fixed this session) — sourced
      `payment-service/.env` for `STRIPE_SECRET_KEY` (Spring Boot does not auto-load `.env`).
      Verified a checkout session is created without the former "Payment session failed" error.

- **cart-service empty-cart 404** (fixed this session) — `GET /api/cart/:userId` returns
      `200 []` for a brand-new user's empty cart instead of 404 (the 404 was thrown as an
      `AxiosError` and treated as failure by the cart page).

---

## Suggested order of attack

1. V-01 ✅, V-02 ✅, V-04 (auth + role hardening) — everything else depends on auth working.
2. V-06, V-11 (stop hash leakage) + V-09 pattern everywhere.
3. V-05 ✅, V-07 ✅, V-03 ✅ (payment/order trust) — then V-12.
4. V-08, V-10 (frontend/token storage + CORS).
5. Dependency upgrades + rate limiting, in parallel with the above.