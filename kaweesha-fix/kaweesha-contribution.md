# SE4030 Group Assignment — Individual Contribution Report

## Author

**Kaweesha Nethmina** — group member responsible for the **user-service**, **order-service**, **payment-service** and the **frontend pages that talk to them** (login/sign-in, checkout, payment-success, customer orders, restaurant/admin dashboards that call order-service).

This document is the individual write-up behind the group report. It follows the assignment requirements: how vulnerabilities were **identified** (white-box and black-box), **how they were fixed**, the **OAuth / OpenID Connect feature** implemented, what was **not fixed and why**, and the **software-engineering practices** that would have prevented the issues.

> Companion documents: [`vulnerability-assessment.md`](./vulnerability-assessment.md) (findings + black-box evidence), [`fixed-vulnerability.md`](./fixed-vulnerability.md) and the interactive [`fixed-vulnerability.html`](fixed-vulnerability.html) (fix details), [`demo-security.sh`](./demo-security.sh) (live exploit/fix demo, 33/33 PASS).

---

## 1. Role and scope of my contribution

| Area | What I owned |
|---|---|
| `backend/user-service` (Node/Express/JWT/bcrypt/Mongoose) | Registration/login hardening, role whitelist, safe user serialisation, rate limiting, Google **OAuth/OIDC sign-in**, secret handling, generic errors |
| `backend/order-service` (Node/Express/Mongoose) | Full authentication/authorisation layer, server-side pricing, Joi validation, rate limiting, server-side Stripe payment verification, ownership/IDOR protection, error handling |
| `backend/payment-service` (Java/Spring Boot/Stripe) | Server-side amount re-computation, CORS allowlist, generic error bodies, verification endpoint, metadata binding |
| Related `frontend/platoo-client` (Next.js/React) | Google Identity Services sign-in; **BFF httpOnly-cookie session** (V-08) + same-origin allowlisted `/api/proxy/*` replacing every direct `Authorization` caller; role/id identity keys shown but never the JWT; checkout payloads no longer carry client prices; ORS key removed from bundle; images load with CORP `cross-origin` |

---

## 2. Methodology and tooling

### 2.1 White-box (static analysis)

| Tool / activity | What it produced |
|---|---|
| Manual source review of every file in the three backend services and every in-scope frontend page | All 12 findings (V-01–V-12) |
| `npm audit --json` (user-service, order-service) | user-service **10** advisories (7 high), order-service **23** (1 critical, 15 high) — dependency inventory in the assessment report §4 |
| Inspected payment-service `pom.xml` manually | `stripe-java` 24.3.0 outdated; unused thymeleaf dependency |
| End-to-end trace of login → checkout → Stripe redirect → order creation | Confirmed broken trust boundary: order-service and payment-service never verified the JWT or the payment |
| `npx tsc --noEmit` (order, user, menu) | Type-safety gate before/after every fix |
| `.env.example` / config review | Verified no secret values in source; all secrets remain git-ignored |

### 2.2 Black-box (dynamic analysis)

| Tool / activity | What it produced |
|---|---|
| Manual `curl` exploit probes against the **live** services on ports 4000 (user) and 3008 (order) | **BB-01…BB-11** — 8 of the 12 findings independently confirmed exploitable at runtime (see assessment §6), e.g. `role:"admin"` registration produced a real admin JWT, `/api/auth/users` returned bcrypt hashes to anonymous callers, `GET /api/orders` returned the whole collection with no token |
| Automated regression suite `backend/order-service/tests/security/order-security.test.ts` | **12/12 PASS** covering 401, server-side totals, mass-assignment 400, IDOR, invalid qty, NoSQL id injection, forbidden fields, no error leakage, XSS-safe storage, 404, idempotent replay, rate limit |
| `kaweesha-fix/demo-security.sh` — a self-contained live demo harness | Runs the whole assignment story against the **real** services in real time: **33/33 PASS** (user + order + payment + transport) |
| CORS / preflight checks with hostile `Origin: https://evil.example.com` | Confirmed V-10 before, then confirmed rejection after fix |
| OWASP Top 10 (2021) mapping | Every finding labelled with category (A01, A02, A03, A04, A05, A07) in the assessment report |

> `OWASP ZAP` and OWASP `dependency-check` were identified in the group plan as final validation tooling; the automated suite + live harness above are the black-box evidence for my services.

---

## 3. Vulnerabilities found and fixed (my services)

| ID | Finding | Sev | OWASP | How it was fixed | Evidence |
|---|---|---|---|---|---|
| V-01 | Hardcoded admin creds in `seed-admin.js` | Critical | A07 | `ADMIN_PASSWORD` required from env, else a strong random password generated and printed once; override/rotation via `ADMIN_EMAIL` / `ADMIN_RESET_PASSWORD=1` | `git grep` clean; login with defaults fails |
| V-02 | `register` accepted `role:"admin"` (self privilege escalation) | Critical | A01 | Server whitelist `PUBLIC_REGISTRATION_ROLES`; any other value (incl. `admin`) downgraded to `user`; Mongoose enum validates. Duplicate email now returns clean **409** (was 500) | `register(role:"admin")` → user role (`authController.ts`, Mongoose schema in `models/User.ts`) |
| V-03 | Stripe billed a client-supplied `amount` | Critical | A04 | Checkout accepts only `orderId`; `StripeService.computeTrustedAmount()` re-fetches the order via the internal key and recomputes `sum(price×qty) + delivery_fee + tax`; line item + `order_id` metadata set server-side | Live Stripe Test session charged the stored payable (1496 = 1200 + 200 + 96) |
| V-04 | No auth on any order route; `user_id` from body | Critical | A01 | `protect(roles?)` (shared user-service JWT) on every route; trusted `x-internal-key` header for admin/internal service bypass; controllers enforce `isOwnerOrPrivileged`; identity always taken from the verified JWT | `POST /api/orders` → 401 without token; IDOR read/update/delete → 403 |
| V-05 | Order created on `/payment-success` without verifying Stripe | High | A04 | Success page sends `session_id`; order-service `PATCH /orders/:orderId/payment` → payment-service `GET /api/verify-payment/{sessionId}` → checks Stripe `payment_status=paid` and metadata `order_id`, then marks order paid + emails. Idempotent; failure redirects back to checkout | Only a genuinely paid, matching session flips the order to `paid` |
| V-06 | Password hashes leaked by `/users`, `/user/:id`, `/restaurant-owner/:id` | High | A01 | `/users` → admin/restaurant-owner only; `/user/:id` → authenticated roles; owner helper stays public but safe-fields only; every response built via `.select('-password -googleId')` / `toSafeUser()` | 401 anon / 403 customer / 200 no-hash owner; no `password` key anywhere |
| V-07 | Totals built from client `item.price` | High | A04 | Order-service resolves real prices via menu-service quote; `delivery_fee` from the restaurant record; `tax` 8% added server-side; `user_id/status/total_amount/delivery_fee/tax` forbidden or ignored; idempotency key | Client price silently overridden (server total 1496); mass-assignment → 400 with `failed[]`; replay → same order (`idempotent:true`) |
| V-08 | JWT in `localStorage` (XSS-accessible) | Medium | A03 | Server-only BFF session cookie: Next.js route handlers (`/api/auth/login|google`) put the user-service JWT in an **HttpOnly SameSite=Lax cookie** and never return it to JS; client pages keep only non-secret role/id identity keys; a same-origin allowlisted proxy (`/api/proxy/{user,order,pay}/*`) attaches the cookie server-side and `/api/auth/session` validates it via the new user-service `GET /api/auth/me`; `"jwtToken"`/`"token"` key duplication removed | client grep audit: **no** `localStorage` JWT reads, inline `Authorization: Bearer`, `jwtDecode`, or `atob` remaining; `tsc` passes |
| V-09 | Services relayed internal `error.message` / Stripe internals | Medium | A05 | Central generic 404/500 handlers in all services; `authController` error paths generic (no more password logging); payment-service returns only generic `FAILED` bodies and never `StripeException.getMessage()` | order-service no-leak test; manual error-path curl checks clean |
| V-10 | `cors()` allowed every origin | Medium | A05 | `CORS_ORIGINS` env allowlist on user-, order-, menu- and payment-service (`WebConfig`), default `http://localhost:3000,http://127.0.0.1:3000` | malicious `Origin` rejected in preflight; dev frontend still works |
| V-11 | `PUT /auth/update/:userId` echoed the password hash | Medium | A02 | Response uses `toSafeUser(user)`; `newPassword` enforces the same server-side strength policy as register (400 on weak input) | `updateUser` response contains no `password` |
| V-12 | `GET /api/orders` returned every order; client filtered | High | A01 | Endpoint protected + privileged-roles only; customers use `GET /orders/history/:userId`, which requires `:userId === JWT subject`; dashboard switched to history endpoint | anon → 401; customer → 403; someone else's history → 403 |

### Additional hardening in my scope

| Item | Fix |
|---|---|
| Login brute force (no throttling) | Auth route limiter (default 20/10 min, `RATE_LIMIT_AUTH_MAX`/`RATE_LIMIT_AUTH_WINDOW_MS` env-tunable) + global limiter on user-service; order-service limits all `/api/orders` routes at 30/min (`RATE_LIMIT_ORDER_MAX/WINDOW_MS`). Fixed a **real bug**: user-service `app.ts` read the env limits before `dotenv.config()` ran, so the `.env` overrides were inert |
| Weak / missing server-side password policy | Server now mirrors the client policy (8–128 chars, upper/lower/digit/special) on both `register` and `updateUser`; email format validated server-side; register log no longer includes the request body |
| OpenRouteService key shipped in the frontend bundle | Moved to `NEXT_PUBLIC_ORS_API_KEY` + documented in `frontend/platoo-client/.env.local.example`; graceful fallback if unset |
| Menu images blocked by CORP | `menu-service` serves `/uploads/` with `Cross-Origin-Resource-Policy: cross-origin` |
| ~20 frontend callers | All order/payment/customer/dashboard requests now attach `Authorization: Bearer <JWT>` retrieved from the stored token |

---

## 4. OAuth / OpenID Connect feature (assignment requirement)

A new **Google Sign-In** feature was added to the existing login flow — this is an **OpenID Connect (OIDC)** sign-in over Google's OAuth 2.0 authorization server.

- **Grant type / flow:** Google Identity Services sign-in (ID-token flow). The browser redirects the user to Google, Google returns an **OIDC ID token** to the client, and the client forwards the raw ID token to our backend. The backend verifies the token's signature, issuer and **audience** against our `GOOGLE_CLIENT_ID` using `google-auth-library`.
- **Backend** — `backend/user-service/src/controllers/authController.ts` (`googleAuth`, route `POST /api/auth/google`):
  1. Requires `idToken` (missing → 400).
  2. `OAuth2Client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })` — cryptographic signature + audience + `sub`/`email` claim verification.
  3. Finds the user by email; if absent, auto-provisions a `user`-role account with `authProvider:"google"` and the `googleId` (never a local password); if the account was local, links the Google id.
  4. Issues the normal application JWT via `generateToken(user.id, user.role)` so every subsequent request uses the exact same authz chain as local login.
- **Frontend** — `frontend/platoo-client/app/login/page.tsx` + `app/layout.tsx`:
  - Loads Google Identity Services script (`accounts.google.com/gsi/client`) and renders the GSI button.
  - `handleGoogleCredentialResponse` forwards `credential` (the ID token) to `POST http://localhost:4000/api/auth/google`, then follows the identical post-login path (store JWT, update context, redirect) so behaviour is consistent with password login.
- **Why OIDC here:** single sign-on with Google, no password for the user, and the app never sees/store a Google password; account linking is safe because identity is bound to the verified `sub` claim, not an arbitrary email.
- **Verified:** a Google idToken → `200 { token }`; an arbitrary/malformed token → `401 "Invalid Google token"`; missing token → 400.

---

## 5. Live demonstration evidence (black-box, my services)

`bash kaweesha-fix/demo-security.sh` drives the **real** services (user-service :4000, order-service :3008, payment-service :8081, Stripe Test mode) and proves fix → exploit → fixed:

```
PASS 33   SKIP 0   FAIL 0   total 33
```
- user-service: weak password → 400 · malformed email → 400 · claimed `role:admin` downgraded to `user` · login → real JWT · duplicate email → **409** · wrong password → 401 generic · `/users` → 401/403 by role · profile/owner responses contain **no** `password`/`googleId`
- order-service: forged order fields → 400 · client `price` ignored (total recomputed from live menu: **1496**) · ownership from JWT · 401/403 + IDOR blocked · idempotency replay → same order · 30/min throttle → 429
- payment-service: empty checkout → generic `FAILED` · real order → Stripe Test session (`cs_…`, `checkout.stripe.com`) charged the stored payable
- transport: helmet `X-Frame-Options` · CORS allowlist rejects evil Origin · `/uploads/` CORP `cross-origin`

The harness then **cleans up after itself** (deletes demo users and orders; waits out the order rate-limit window so the deletes actually succeed — a throttling side effect I found and fixed while verifying the delete endpoints). Use `--keep` to retain data for inspection.

**Residual fixes verified (2026-09-23):**
- V-08: `platoo_token` cookie is HttpOnly/SameSite=Lax/1-day from server route handlers and never
  reaches JS; `grep` over `app/ components/ hooks/ lib/` confirms **no** `localStorage.getItem("token"|"jwtToken")`,
  **no** inline `Authorization: Bearer`, **no** `jwtDecode`/`atob` in client code.
- Dependencies: `npm audit` → **0 vulnerabilities** (user-service & order-service).
- NoSQL hygiene: `rejectNoSqlOperators` middleware active on every order/user route.
- Payment: `dependency-check-maven` wired; `mvn validate` passes.

`npx tsc --noEmit` passes for user-service and order-service after all changes (menu-service
unchanged, still passes).

---

## 6. Residuals and the reason

Items from the assessment's "not-fixed" list that **have now been fixed** (and how):
- **V-08 (JWT in `localStorage`)** → fixed with a server-only BFF session cookie (§5 table + §8).
- **Dependency advisories (user 10, order 23)** → `npm audit fix` brings both services to
  **0 vulnerabilities** (unused `sequelize`/`sequelize-cli` removed; `nodemailer` 6→10 patched);
  OWASP `dependency-check-maven` wired into payment-service `pom.xml` (opt-in, CVSS≥8 gate).
- **NoSQL injection hygiene** → `rejectNoSqlOperators` middleware now screens `$`-keys,
  dot-notation keys, and `$`-prefixed values on every order- and user-service route.
- **Old OpenRouteService key** → removed from code/bundle; the **manual** revocation in the
  OpenRouteService console remains a user action outside the repo.

| Item | Why still open |
|---|---|
| Privileged `GET /orders` returns all orders to every admin/restaurant-owner/delivery person | Proper scoping needs restaurant-owner→restaurant and delivery-man→assignment mappings (group scope, requires the menu-service member's data model). |
| JWT revocation/refresh | Tokens are 1-day with no server-side blacklist. Logout clears the cookie; a full revocation store was out of scope. |
| ORS key revocation in the console | Requires login to the OpenRouteService dashboard (user action). |
| `stripe-java` 24.3.0 → latest | Best-practice bump, no advisory on the runtime path; keeping the demo's verified Stripe session stable meanwhile. |

Everything else in the assessment is fixed and reverified (§8). Details remain in
`security-todo.md`.

---

## 7. Software-engineering practices that would have prevented these

1. **Never trust the client (server-side validation as a default).** V-02, V-03, V-07, V-04 all came from trusting client-supplied role, amount, price, and user identity. A secure-design rule — *every input is validated, every authority is derived from the session token* — eliminates an entire class.
2. **AuthN/Z as middleware, not an afterthought.** Routes that "had no auth yet" (V-04, V-06, V-12) show authZ must be planned in the route table at design time and enforced by a shared `protect()` middleware, with ownership/IDOR checks in one helper (`isOwnerOrPrivileged`).
3. **Threat-modelling before coding.** A short architecture-diagram walkthrough of the login → checkout → Stripe → order flow would have exposed the broken trust boundary (no inter-service verification) before it shipped.
4. **Secrets management from day one.** V-01 (seed admin creds) and the ORS key would not have happened with `.env`-only secrets, `.gitignore` coverage, and a rotation policy. Secret scanners in CI catch regressions.
5. **Security regression tests as part of the build.** The 12-test order-service suite caught nothing new by luck — it prevents the fixes from silently regressing. CI should run it plus `npm audit` and OWASP dependency-check on every commit.
6. **Basic operational hardening as defaults:** rate limiting on auth and write endpoints, generic error bodies (V-09), a strict CORS allowlist (V-10), helmet headers — cheap to add, expensive to retrofit.
7. **Least-privilege data exposure.** Never serialise the whole document to the client (V-06, V-11); explicit `toSafeUser()` / projection keeps domain objects off the wire.

---

## 8. Verification recap (how to reproduce)

```bash
# type & lint gates
cd backend/user-service && npx tsc --noEmit
cd backend/order-service && npx tsc --noEmit
cd backend/payment-service && mvn -o -q compile

# order-service security regression suite
cd backend/order-service && npm run test:security          # 12/12 PASS

# live exploit/fix demo against the running stack (user:4000 order:3008 payment:8081)
bash kaweesha-fix/demo-security.sh                          # 33/33 PASS
```

Raw dependency audit output: `kaweesha-fix/audit-raw-user-service.txt`, `kaweesha-fix/audit-raw-order-service.txt`.
Reports: `vulnerability-assessment.md` (findings + black-box), `fixed-vulnerability.md` / `.html` (fixes), `security-todo.md` (residuals), `SECURITY.md` (repo-wide policy).