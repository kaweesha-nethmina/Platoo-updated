# Security Fix Todo List — Platoo

Actionable todo list derived from [`vulnerability-assessment.md`](./vulnerability-assessment.md).
Boxes marked `[x]` are already addressed by the Google-auth and form-validation work plus the
V-01 admin-credential fix (see [`kaweesha.md`](./kaweesha.md)); everything else is outstanding.

Legend: Critical → do first · High → next · Medium → then · Observations → hardening backlog.

---

## Critical

- [x] **V-01 — Remove hardcoded admin credentials** (`seed-admin.js:6-7`)
      Done: `seed-admin.js` now requires `ADMIN_PASSWORD` from the environment or
      generates a strong random password (logged once, never committed).
      `ADMIN_EMAIL` / `ADMIN_RESET_PASSWORD=1` allow overriding the email and
      rotating an existing admin password. See `kaweesha.md`.

- [ ] **V-02 — Prevent unauthenticated self-role-assignment on register** (`authController.ts:14,31`)
      Server-side: ignore client-supplied `role` on registration, default to `"user"`.
      Assign elevated roles only via admin-only flows. Add a Mongoose enum validator.

- [ ] **V-03 — Recompute payment amount server-side** (payment-service `StripeService.java:23`)
      Accept an order reference, look up items, compute the trusted total;
      never trust client-supplied `amount`.

- [ ] **V-04 — Add authentication to order-service** (all routes `orderRoutes.ts`, `app.ts:17`)
      Apply user-service JWT verification middleware to every order route;
      enforce that non-admin users only touch their own resources.

---

## High

- [ ] **V-05 — Verify Stripe payment before creating the order** (`payment-success/page.tsx:10-43`)
      Parse `session_id` from the URL, call payment-service verify-payment server-side,
      and only then create the order. Never trust `localStorage` state alone.

- [ ] **V-06 — Stop leaking password hashes** (`authController.ts:149-161,164-191,197-221`,
      `auth.ts:46-55`)
      Add auth middleware to `/users`, `/user/:userId`, `/restaurant-owner/:userId`;
      return users with `.select('-password')` (or a `toSafeJSON()` method).

- [ ] **V-07 — Use server-side prices for order totals** (order-service `orderService.ts:22-23,124`)
      Look up each `menu_item_id` and compute `totalAmount` from DB prices;
      reject or override client-supplied prices.

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
      Partial: ✅ new Google-auth endpoint already returns a generic `401` (see `kaweesha.md`).

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

- [ ] **payment-service deps** — update `stripe-java` (24.3.0 → latest 27.x+); drop
      unused `spring-boot-starter-thymeleaf`; run OWASP dependency-check.

- [ ] **NoSQL injection hygiene (order-service)** — keep user input out of Mongo
      operators (`$nor`, `$or`, …) and upgrade mongoose past the sanitizeFilter bypass CVE.

---

## Suggested order of attack

1. V-01 ✅, V-02, V-04 (auth + role hardening) — everything else depends on auth working.
2. V-06, V-11 (stop hash leakage) + V-09 pattern everywhere.
3. V-05, V-07, V-03 (payment/order trust) — then V-12.
4. V-08, V-10 (frontend/token storage + CORS).
5. Dependency upgrades + rate limiting, in parallel with the above.