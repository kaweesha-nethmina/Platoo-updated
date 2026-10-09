# SE4030 Group Assignment — Individual Contribution Report

## Author & scope

**Kaweesha Nethmina** — group member responsible for the **user-service**, **order-service**,
**payment-service** and the **frontend pages that talk to them** (login / Google sign-in, checkout,
payment-success, customer orders, and the restaurant/admin dashboards that call order-service).

- **Student ID:** *(fill in)*
- **Report date:** 2026-09-23
- **Role:** security assessment → fix → re-verify for the ownership above; the OAuth/OIDC feature;
  the residual security items assigned to me; documentation + reproducible evidence harnesses.

This document is the individual write-up behind the group report. It follows the assignment
requirements: how vulnerabilities were **identified** (white-box and black-box), **how they were
fixed** (with precise file references), the **OAuth / OpenID Connect feature** implemented, what
remains **open and why**, and the **software-engineering practices** that would have prevented the issues.

> Companion documents: [`vulnerability-assessment.md`](./vulnerability-assessment.md) (findings +
> black-box evidence), [`fixed-vulnerability.md`](./fixed-vulnerability.md) and the interactive
> [`fixed-vulnerability.html`](fixed-vulnerability.html) (fix details), [`demo-security.sh`](./demo-security.sh)
> (live exploit/fix demo, **38/38 PASS**), [`security-todo.md`](./security-todo.md) (residuals),
> [`SECURITY.md`](../SECURITY.md) (repo-wide policy).

---

## 1. Role and scope of my contribution

| Area | What I owned |
|---|---|
| `backend/user-service` (Node/Express/JWT/bcrypt/Mongoose) | Registration/login hardening, role whitelist, safe user serialisation, rate limiting, Google **OAuth/OIDC sign-in**, server-side password policy, **JWT revocation/blacklist**, secret handling, generic errors |
| `backend/order-service` (Node/Express/Mongoose) | Full authentication/authorisation layer, server-side pricing, Joi validation, rate limiting, server-side Stripe payment verification, ownership/IDOR protection, **role-scoped order listing**, NoSQL hygiene, error handling |
| `backend/payment-service` (Java/Spring Boot/Stripe) | Server-side amount re-computation, CORS allowlist, generic error bodies, verification endpoint, metadata binding, dependency upgrades |
| Related `frontend/platoo-client` (Next.js/React) | Google Identity Services sign-in; **BFF httpOnly-cookie session** (V-08) + same-origin allowlisted `/api/proxy/*` replacing every direct `Authorization` caller; role/id identity keys shown but never the JWT; **server-side logout/revocation wiring**; checkout payloads no longer carry client prices; ORS key removed from bundle |
| `kaweesha-fix/` + repo tooling | `demo-security.sh` live harness (38 checks), `fixed-vulnerability.md/.html`, `vulnerability-assessment.md`, `security-todo.md`, `SECURITY.md`, test suites, `start-all.sh` launcher cleanup |

### Files I changed or added (complete inventory)

**user-service**
- `src/controllers/authController.ts` — hardened `register`/`login`, added `googleAuth`,
  `logout`, safe `updateUser`/`getCurrentUser`, duplicate-email → `409` (lines ~46, 100, 120, 167, 302, 355)
- `src/middleware/authMiddleware.ts` — `protect(roles?)` + `hashToken` + fail-closed `isRevoked`
  (lines 20, 26, 37, 55)
- `src/models/TokenBlacklist.ts` — **new**: unique `tokenHash` + TTL index (`expiresAt`)
- `src/routes/auth.ts` — `POST /logout` (protected), `GET /verify` (protected introspection)
- `src/app.ts` — auth limiter scoped to `/login|register|google` (V-14 cross-cutting fix), CORS env allowlist
- `src/models/User.ts` — role enum + mongoose validation
- `seed-admin.js` — no default credentials (env-driven)

**order-service**
- `middleware/authenticate.ts` — `protect` now **async**, optional `JWT_INTROSPECT_URL`
  server-side verification (V-14; lines 38, 68-85)
- `controllers/orderController.ts` — `getAllOrders` role-scoped (V-13; line 79);
  all controllers enforce `isOwnerOrPrivileged`, identity from verified JWT
- `services/orderService.ts` — `getAllOrders(filter?)` (line 210), `getRestaurantsByOwnerId` (line 217),
  `computeTotals` server-side pricing (line 103)
- `validators/order.schemas.ts` — Joi schemas (ObjectId patterns, quantities, forbidden server-owned fields)
- `middleware/rejectNoSqlOperators.ts` — **new**: `$`/dot-key/`$value` screen on params/query/body
- `routes/orderRoutes.ts`, `app.ts` — protect on every route, order limiter 30/min, CORS, generic errors
- `.env.example` (+ gitignored `.env`) — `JWT_SECRET`, `INTERNAL_SERVICE_KEY`, `JWT_INTROSPECT_URL`
- `tests/security/order-security.test.ts` — 12-case regression suite

**payment-service**
- `pom.xml` — **`stripe-java` 24.3.0 → 24.24.0**; OWASP `dependency-check-maven` (opt-in, CVSS≥8 gate)
- `ProductCheckoutController` / `PaymentVerificationController` — generic `400`/`FAILED` bodies,
  never relay `StripeException.getMessage()`; `order_id` metadata
- `StripeService` — `computeTrustedAmount()` re-fetches the order via the internal key
- `config/WebConfig.java` — CORS from `CORS_ORIGINS` allowlist

**frontend `platoo-client` (Next.js App Router)**
- `app/api/auth/login/route.ts`, `google/route.ts` — server-only; set HttpOnly `platoo_token` cookie
- `app/api/auth/logout/route.ts` — **new**: POSTs the cookie token to user-service `/logout`
  (server-side revocation) then deletes the cookie
- `app/api/auth/session/route.ts` — validates via user-service `GET /api/auth/me`
- `app/api/proxy/[service]/[...path]/route.ts` — same-origin allowlisted proxy (user/order/pay)
- `lib/server-auth.ts`, `hooks/useUserContext.tsx` — cookie identity handling
- `app/login/page.tsx`, `app/layout.tsx` — GSI sign-in + BFF flow
- `components/dashboards/restaurant-dashboard.tsx` — sign-out now **POSTs** `/api/auth/logout`
  (was a GET → 405); ~119 files migrated off `localStorage` JWT
- `components/dashboards/delivery-dashboard.tsx` — ORS key → `NEXT_PUBLIC_ORS_API_KEY`

**Repos/Tooling**
- `kaweesha-fix/demo-security.sh` — 38 live checks + self-cleaning harness
- `kaweesha-fix/fixed-vulnerability.md` / `.html`, `security-todo.md`, `kaweesha-contribution.md`
- `start-all.sh` — leftover-watcher/port sweep at start and on Ctrl-C (services kept holding ports)

---

## 2. Methodology and tooling

### 2.1 White-box (static analysis)

| Tool / activity | What it produced |
|---|---|
| Manual source review of every file in the three backend services and every in-scope frontend page | All 12 findings (V-01–V-12) + 2 residual items (V-13, V-14) |
| `npm audit --json` (user-service, order-service) | user-service **10** advisories (7 high), order-service **23** (1 critical, 15 high) → dependency inventory in assessment §4 |
| Inspected payment-service `pom.xml` manually | `stripe-java` 24.3.0 outdated; unused thymeleaf dependency |
| End-to-end trace of login → checkout → Stripe redirect → order creation | Confirmed the broken trust boundary: order- and payment-service never verified the JWT or the payment |
| `npx tsc --noEmit` (user, order, menu) | Type-safety gate before/after every fix |
| `.env.example` / config review | Verified no secret values in source; all secrets remain git-ignored; env var read-order bug found and fixed |

### 2.2 Black-box (dynamic analysis)

| Tool / activity | What it produced |
|---|---|
| Manual `curl` exploit probes against the **live** services on :4000 (user) and :3008 (order) | **BB-01…BB-11** — 8 of the 12 findings independently confirmed exploitable at runtime (assessment §6), e.g. `role:"admin"` registration produced a real admin JWT, `/api/auth/users` returned bcrypt hashes to anonymous callers, `GET /api/orders` returned the whole collection with no token |
| Automated regression suite `order-service/tests/security/order-security.test.ts` | **12/12 PASS**: 401, server-side totals, mass-assignment 400, IDOR, invalid qty, NoSQL id, forbidden fields, no leakage, XSS-safe storage, 404, idempotent replay, rate limit |
| `kaweesha-fix/demo-security.sh` — self-contained live harness | The assignment story against the **real** services: **38/38 PASS** (user + order + payment + transport + V-14 residuals + rate limit), self-cleaning |
| CORS / preflight probes with `Origin: https://evil.example.com` | Confirmed V-10 before → confirmed rejection after |
| Introspection/lifecycle probes for revocation | `verify 200 → logout 200 → verify/me 401`; order-service rejects the revoked token with `401 "Unauthorized: Token revoked"` |
| Chef user-transfer probe for role scoping | Restaurant moved between owners → order count follows the owner exactly; non-owned `restaurant_id` → 403 |
| OWASP Top 10 (2021) mapping | Every finding labelled with its category (A01, A02, A03, A04, A05, A07) in the assessment report |

> Note: `OWASP ZAP` and OWASP `dependency-check` were identified in the group plan as final
> validation tooling; the automated suite + live harness above are my black-box evidence.

---

## 3. Vulnerabilities found and fixed (my services)

| ID | Finding | Sev | OWASP | How it was fixed | Evidence |
|---|---|---|---|---|---|
| V-01 | Hardcoded admin creds in `seed-admin.js` | Critical | A07 | `ADMIN_PASSWORD` required from env, else a strong random password generated and printed once; override/rotation via `ADMIN_EMAIL` / `ADMIN_RESET_PASSWORD=1` | `git grep` clean; login with defaults fails |
| V-02 | `register` accepted `role:"admin"` (self privilege escalation) | Critical | A01 | Server whitelist `PUBLIC_REGISTRATION_ROLES`; any other value (incl. `admin`) downgraded to `user`; Mongoose enum validates. Duplicate email now returns clean **409** (was 500) | `register(role:"admin")` → user role (`authController.ts:46`, `models/User.ts`) |
| V-03 | Stripe billed a client-supplied `amount` | Critical | A04 | Checkout accepts only `orderId`; `StripeService.computeTrustedAmount()` re-fetches the order via the internal key and recomputes `sum(price×qty) + delivery_fee + tax`; line item + `order_id` metadata set server-side | Live Stripe Test session charged the stored payable (1496 = 1200 + 200 + 96) |
| V-04 | No auth on any order route; `user_id` from body | Critical | A01 | `protect(roles?)` (shared user-service JWT) + trusted `x-internal-key` bypass on every route; controllers enforce `isOwnerOrPrivileged`; identity always from the verified JWT | `POST /api/orders` → 401 without token; IDOR read/update/delete → 403 |
| V-05 | Order created on `/payment-success` without verifying Stripe | High | A04 | Success page sends `session_id`; order-service `PATCH /orders/:orderId/payment` → payment-service verify → checks `payment_status=paid` + metadata `order_id`, then marks paid + emails. Idempotent; failure redirects back to checkout | Only a genuinely paid, matching session flips the order to `paid` |
| V-06 | Password hashes leaked by `/users`, `/user/:id`, `/restaurant-owner/:id` | High | A01 | `/users` → admin/owner only; `/user/:id` → authenticated roles; owner helper public but safe-fields only; every response `.select('-password -googleId')` / `toSafeUser()` | 401 anon / 403 customer / 200 no-hash owner; no `password` key anywhere |
| V-07 | Totals built from client `item.price` | High | A04 | Prices resolved via menu-service quote; `delivery_fee` from the restaurant record; `tax` 8% server-side; `user_id/status/total_amount/delivery_fee/tax` forbidden or ignored; idempotency key | Client price overridden (server total 1496); mass-assignment → 400 `failed[]`; replay → same order (`idempotent:true`) |
| V-08 | JWT in `localStorage` (XSS-accessible) | Medium | A03 | BFF session cookie: server-only `/api/auth/login|google` put the JWT in an **HttpOnly SameSite=Lax** cookie, never returned to JS; client keeps only non-secret role/id keys; `/api/proxy/{user,order,pay}/*` attaches it; `/api/auth/session` validates via `GET /api/auth/me`; `"jwtToken"`/`"token"` duplication removed | client grep audit: **no** `localStorage` JWT reads / inline Bearer / `jwtDecode` / `atob`; `tsc` + `next build` pass |
| V-09 | Services relayed internal `error.message` / Stripe internals | Medium | A05 | Central generic 404/500 handlers (order/user/menu); `authController` error paths generic (no password logging); payment returns generic `FAILED`, never `StripeException.getMessage()` | order-service no-leak test; manual error-path curls clean |
| V-10 | `cors()` allowed every origin | Medium | A05 | `CORS_ORIGINS` allowlist on user/order/menu + payment (`WebConfig`), default `http://localhost:3000,http://127.0.0.1:3000` | malicious `Origin` rejected in preflight; dev frontend works |
| V-11 | `PUT /auth/update/:userId` echoed the password hash | Medium | A02 | Response uses `toSafeUser(user)`; `newPassword` enforces the same server-side strength policy as register (400 on weak input) | `updateUser` response contains no `password` |
| V-12 | `GET /api/orders` returned every order; client filtered | High | A01 | Endpoint protected + privileged-roles only; customers use `GET /orders/history/:userId` requiring `:userId === JWT subject`; dashboard switched to history endpoint | anon → 401; customer → 403; someone else's history → 403 |

### 3.1 Residuals closed during the follow-up (V-13 / V-14 etc.)

| ID | Item | Sev | OWASP | How it was fixed | Evidence |
|---|---|---|---|---|---|
| V-13 | Privileged `GET /orders` returned the **whole collection** to every privileged role | High | A01 | Role-scoped server-side (`orderController.ts:79`, `orderService.ts:210-217`): admin/internal → full list (+ optional `?restaurant_id=`); `restaurant_owner` → only their own restaurants (owner→restaurant resolved via the menu-service restaurant list, `getRestaurantsByOwnerId`); non-owned `restaurant_id` → **403**; `delivery_man` → only `['preparing','ready','delivered']`; anything else → 403 | Live: transferred a restaurant between owners → order count follows exactly; non-owned id → 403; delivery user → 0; internal key → full list |
| V-14 | Logout didn't invalidate the JWT — no server-side revocation | High | A07 | New `TokenBlacklist` model (unique `tokenHash`, TTL index) + `POST /api/auth/logout` (upsert, 1-day TTL) + protected `GET /api/auth/verify` introspection endpoint; order-service `protect` verifies **every request** against `JWT_INTROSPECT_URL` and fails closed → `401 "Unauthorized: Token revoked"`. BFF logout posts the token to `/logout` before deleting the cookie; dashboard sign-out fixed to POST (was GET → 405) | Live lifecycle: `verify 200 → logout 200 → verify/me 401`, and order-service rejects the revoked token cross-service |
| R-3 | `stripe-java` 24.3.0 outdated (no advisory, best practice) | — | — | `pom.xml` bumped to **24.24.0**; clean rebuild + re-verified under **JDK 17** (class v61) | `mvn -o compile` clean; payment serving on :8081; `major version: 61` |
| R-4 | Auth limiter re-throttled bearer routes (breaks `/me`, `/verify`, `/logout`, order introspect) | Medium | A07 | user-service `app.ts` now applies the strict limiter **only** to `/api/auth/login|register|google`; global limiter still covers the rest | order-service introspection no longer 429s; session/logout work |

### Additional hardening in my scope

| Item | Fix |
|---|---|
| Login brute force (no throttling) | Auth limiter 20/10min env-tunable + global limiter on user-service; order-service `/api/orders` 30/min. Fixed a real bug: env limit vars read **before** `dotenv.config()` ran (values were inert) |
| Weak / missing server-side password policy | Server mirrors client policy (8–128, upper/lower/digit/special) on `register` + `updateUser`; email validated server-side; register log no longer includes the request body |
| OpenRouteService key shipped in the frontend bundle | Moved to `NEXT_PUBLIC_ORS_API_KEY` (`.env.local.example`); graceful fallback |
| Menu images blocked by CORP | `menu-service` serves `/uploads/` with `Cross-Origin-Resource-Policy: cross-origin` |
| NoSQL injection hygiene | `rejectNoSqlOperators` middleware screens `$`-keys, dot-notation keys and `$`-prefixed values on every order- and user-service route |
| Dependency advisories | `npm audit fix` → **0 vulnerabilities** in user-service (10) and order-service (23); unused `sequelize`/`sequelize-cli` removed; `nodemailer` 6→10 patched; OWASP `dependency-check-maven` wired into payment `pom.xml` |
| BFF logout → server-side revocation | `app/api/auth/logout/route.ts` posts the cookie token to user-service `/logout` (best-effort) before deleting the cookie; `restaurant-dashboard.tsx` sign-out now uses POST |
| Launcher hygiene (ops, found during verification) | `start-all.sh` sweeps leftover `nodemon`/`ts-node-dev`/`next` watchers and occupied app ports at start and on Ctrl-C (killing only the `npm`/`mvn` wrapper previously orphaned them) |
| Follow-up fixes found while verifying the demo | cart-service empty-cart 404 → `200 []`; checkout `menu_item_id`/`restaurant_id` serialisation bugs in `checkout/page.tsx` and `restaurants/[id]/page.tsx` |

---

## 4. OAuth / OpenID Connect feature (assignment requirement)

A new **Google Sign-In** feature was added to the existing login flow — **OpenID Connect (OIDC)**
sign-in over Google's OAuth 2.0 authorization server.

- **Flow:** Google Identity Services **ID-token flow**. The user clicks the GSI button; Google returns
  an **OIDC ID token** to the client; the client forwards it to our **BFF** route `/api/auth/google`.
- **Backend** — `backend/user-service/src/controllers/authController.ts` → `googleAuth` (line 120):
  1. Requires `idToken` (missing → 400).
  2. `OAuth2Client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })` — cryptographic
     signature, issuer + **audience** (our `GOOGLE_CLIENT_ID`), and `sub`/`email` claim checks.
  3. Finds the user by email; auto-provisions a `user`-role account with `authProvider:"google"`
     and the `googleId` (no local password); links an existing local account by `googleId`.
  4. Issues the normal application JWT via `generateToken(user.id, user.role)` — every subsequent
     request uses the exact same authz chain as local login.
- **BFF integration (V-08):** `/api/auth/google` is a **server-only** route handler that places that
  JWT in the **HttpOnly `platoo_token` cookie** — Google's ID token and our JWT never reach browser JS.
  The client then follows the identical post-login path (identity keys → context → redirect),
  so Google and password logins are consistent and indistinguishable downstream.
- **Why OIDC here:** single sign-on with Google, no password to remember, the app never sees or
  stores a Google password; account linking is safe because identity binds to the verified `sub`
  claim, not an arbitrary email.
- **Verified:** valid Google `idToken` → `200 { token }` (login assets via `/api/auth/session`);
  arbitrary/malformed token → `401 "Invalid Google token"`; missing token → 400.

---

## 5. Live demonstration evidence (black-box, my services)

`bash kaweesha-fix/demo-security.sh` drives the **real** services (user :4000, order :3008,
payment :8081, Stripe Test mode) and proves **exploit → fixed** on every slide:

```
PASS 38   SKIP 0   FAIL 0   total 38
```

- **user-service:** weak password → 400 · malformed email → 400 · claimed `role:admin` downgraded
  to `user` · login → real JWT · duplicate email → **409** · wrong password → 401 generic ·
  `/users` → 401/403 by role · profile/owner responses contain **no** `password`/`googleId`
- **order-service:** forged order fields → 400 · client `price` ignored (total recomputed from live
  menu: **1496**) · ownership from JWT · 401/403 + IDOR blocked · idempotent replay → same order ·
  30/min throttle → 429
- **payment-service:** empty checkout → generic `FAILED` · real order → Stripe Test session
  (`cs_…`, `checkout.stripe.com`) charged the stored payable
- **transport:** helmet `X-Frame-Options` · CORS allowlist rejects evil Origin · `/uploads/` CORP `cross-origin`
- **V-14 residuals:** delivery user's `GET /orders` hides customer carts · `verify 200 → logout 200 →
  `verify`/`me` 401 · order-service rejects the revoked token (`JWT_INTROSPECT_URL`) ·
  rate limiting last (burns the order budget safely)

The harness **cleans up after itself** (deletes demo users/orders; waits out the order rate-limit
window so the deletes actually succeed). Use `--keep` to retain data for inspection.

**Client-side state audit (V-08 proof):** `grep` over `app/ components/ hooks/ lib/` shows **no**
`localStorage.getItem("token"/"jwtToken")`, **no** inline `Authorization: Bearer`,
**no** `jwtDecode`, **no** `atob`. `tsc` and `next build` pass; the BFF cookie flow was verified
end-to-end: `register → login (cookie set) → session 200 → logout (cookie deleted + server blacklist)
→ session 401`.

---

## 6. What remains open, and why

Everything from the assessment that could be fixed in code is now **fixed and verified**. Two items
remain and are intentional:

| Item | Why still open | Mitigation already shipped |
|---|---|---|
| **Old OpenRouteService key** in git history | Requires login to the ORS dashboard to rotate/revoke (a user action outside the repo) | Key removed from source + bundle; `NEXT_PUBLIC_ORS_API_KEY` with graceful fallback; prefer a server-side/BFF proxy for the real key |
| **JWT expiry / refresh-token mechanism** | Design decision — introducing refresh tokens changes the whole auth UX (rotation, reuse detection) | **Revocation itself is shipped** (blacklist + introspection); short-lived tokens + refresh can be layered on top later |

Other team-scope notes (not mine, deliberately unmodified): `menu-service` write routes remain
unauthenticated (they are the server-side price source) and its `GET /:restaurantId` route shadows
`GET /owner/:ownerId` — my owner→restaurant mapping therefore uses the list endpoint and does not
depend on route order.

---

## 7. Key numbers (one-glance summary)

| Metric | Value |
|---|---|
| Findings fixed in code (assessment) | **12 / 12** (V-01 … V-12) |
| Residuals found by follow-up & fixed | **2 / 2** (V-13 role-scoped orders, V-14 revocation) + 2 hardening items (stripe-java, limiter scoping) |
| Live demo harness | **38 / 38 PASS** (was 33; +5 residual/rate-limit checks) |
| Regression suite | **12 / 12 PASS** |
| Client files migrated to BFF cookie (V-08) | ~**119**, no JWT in `localStorage` |
| Dependency vulnerabilities | user-service **10 → 0**, order-service **23 → 0** |
| Stripe payment hardening | amount always recomputed server-side (verified 1496 charged) |
| Type/lint gates | `tsc` clean (user/order/menu), `mvn -o compile` clean (JDK 17), `next build` clean |

---

## 8. Software-engineering practices that would have prevented these

1. **Never trust the client (server-side validation as a default).** V-02, V-03, V-07, V-04 all came
   from trusting client-supplied role, amount, price and user identity. *Every input is validated,
   every authority is derived from the session token.*
2. **AuthN/Z as middleware, not an afterthought.** Routes "with no auth yet" (V-04, V-06, V-12)
   show authZ must live in the route table at design time, enforced by shared `protect()` with one
   `isOwnerOrPrivileged` ownership helper.
3. **Threat-modelling before coding.** A short architecture walkthrough of login → checkout →
   Stripe → order would have exposed the broken inter-service trust boundary before it shipped.
4. **Secrets management from day one.** V-01 (seed admin creds) and the ORS key would not have
   happened with `.env`-only secrets, `.gitignore` coverage and a rotation policy; secret scanners in CI.
5. **Security regression tests as part of the build.** The 12-case suite (plus the 38-check live
   harness) stops the fixes from silently regressing — CI should run them plus `npm audit`/OWASP
   dependency-check on every commit.
6. **Basic operational hardening as defaults:** rate limiting on auth/write endpoints, generic
   error bodies (V-09), strict CORS allowlist (V-10), helmet headers — cheap to add, expensive to retrofit.
7. **Least-privilege data exposure.** Never serialise the whole document to the client (V-06, V-11);
   explicit `toSafeUser()` / projections keep domain objects off the wire.
8. **Kill your watchers (operability).** The demo kept "failing" only because leftover dev watchers
   served stale code and held ports — reproducible runs need deterministic process hygiene.

---

## 9. Verification recap (how to reproduce)

```bash
# type & build gates
cd backend/user-service  && npx tsc --noEmit
cd backend/order-service && npx tsc --noEmit
cd backend/payment-service && JDK_HOME=jdk-17 mvn -o -q compile

# order-service security regression suite
cd backend/order-service && npm run test:security          # 12/12 PASS

# live exploit/fix demo against the running stack (user:4000 order:3008 payment:8081)
bash kaweesha-fix/demo-security.sh                          # 38/38 PASS

# client-side state audit (V-08)
grep -rnE 'getItem\("(token|jwtToken)' frontend/platoo-client/app  # 0 matches
```

**Sessions / timeline**
- **2026-09-20** — reconnaissance + live smoke test; found and fixed the broken checkout chain
  (`restaurant_id`/`menu_item_id` serialisation) that blocked the demo end-to-end.
- **2026-09-22** — main hardening sprint: V-01…V-12 + payment-secure build; regression suite 12/12;
  first `demo-security.sh` (33/33).
- **2026-09-23** — V-08 full BFF-cookie migration (~119 files); dependency audits → 0; NoSQL
  middleware; duplicate-email 409; started the fresh stack reproducibly; closed the residuals
  (role-scoped `GET /orders`, server-side JWT revocation + introspection, `stripe-java` 24.24.0,
  auth-limiter scoping); fixed the BFF sign-out bug; demo extended to **38/38**; produced this
  report + the interactive `fixed-vulnerability.html`.

Raw dependency audit output: `kaweesha-fix/audit-raw-user-service.txt`, `kaweesha-fix/audit-raw-order-service.txt`.
Reports: `vulnerability-assessment.md` (findings + black-box), `fixed-vulnerability.md` / `.html`
(fixes), `security-todo.md` (residuals), `SECURITY.md` (repo-wide policy).