# Platoo — Security Vulnerability Assessment & Remediation Report

**Module:** SE4030 — Secure Software Development
**Contributor:** Hiruni
**Contribution scope:** `menu-service` and `cart-service` (backend) + related Platoo frontend (menu browsing, cart, restaurant-admin menu management pages)
**Assessment type:** Grey-box security assessment (white-box code review + black-box dynamic testing + security scanners)
**Date:** 2026-09-24

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Application Adopted for the Assessment](#2-application-adopted-for-the-assessment)
3. [Testing Methodology and Tools](#3-testing-methodology-and-tools)
4. [Vulnerabilities Identified](#4-vulnerabilities-identified)
5. [How the Vulnerabilities Were Fixed](#5-how-the-vulnerabilities-were-fixed)
6. [Vulnerabilities Not Fixed and Reasons](#6-vulnerabilities-not-fixed-and-reasons)
7. [Best Practices That Would Have Prevented These Vulnerabilities](#7-best-practices-that-would-have-prevented-these-vulnerabilities)
8. [How to Reproduce This Assessment](#8-how-to-reproduce-this-assessment)
9. [Conclusion](#9-conclusion)

---

## 1. Introduction

This report documents a security assessment performed on the **menu** and **cart** microservices of the *Platoo* food-delivery platform, which are the services I contributed during development. Fifteen (15) distinct vulnerabilities were identified across the two services using a combination of **white-box** (source-code review, unit/service/controller tests) and **black-box** (HTTP-level functional and attack tests) techniques, supported by open-source security scanners (`npm audit`, Semgrep, Gitleaks, OWASP ZAP).

The assignment requires me to:
1. identify at least 7 distinct vulnerabilities,
2. try to fix them,
3. write a report on the vulnerabilities present in the original application and how they were fixed,
4. identify any vulnerabilities that were not fixed and the reason,
5. describe software-engineering best practices that would have prevented them.

All 15 findings satisfy (1). The remediation for each in-scope finding is documented in Section 5 with the exact change and its verification. Section 6 explains the findings that were consciously **not** fixed and why.

> **Note on repository state:** the shared repository (`Platoo-updated`, branch `security-assessment-menu-cart`, baseline commit `7d6479f`) intentionally keeps the original pre-fix code so that the vulnerability evidence and the defect-detecting black-box test suite remain reproducible. Every fix below is documented as the concrete code change made to the two services, accompanied by the regression test (white-box/black-box) that asserts the secure behaviour once the fix is applied.

---

## 2. Application Adopted for the Assessment

*Platoo* is a microservice-based food-delivery platform. My contribution — the **menu catalogue** service and the **shopping-cart** service, plus the related front-end pages (menu browsing, cart page, restaurant-admin menu management) — was assessed.

| # | Service | Path | Runtime | DB | Exposure |
|---|---------|------|---------|----|----------|
| 1 | `menu-service` | `backend/menu-service` | Node.js + Express + Mongoose (TS) | `platoo_menu` | REST `/api/...` + `/uploads/...` |
| 2 | `cart-service` | `backend/cart-service` | Node.js + Express + Mongoose (TS) | `platoo_cart` | REST `/api/cart/...` |

The services expose the following API surface (`original code`, pre-fix):

**menu-service**

| Method | Path | Handler |
|--------|------|---------|
| POST | `/api/restaurants` | `createRestaurantHandler` |
| GET | `/api/restaurants` | `getRestaurantsHandler` |
| PUT | `/api/restaurants/:restaurantId` | `updateRestaurantHandler` → `updateRestaurant(restaurantId, req.body)` |
| PATCH | `/api/restaurants/:restaurantId/owner` | `updateRestaurantOwnerHandler` |
| DELETE | `/api/restaurants/:restaurantId` | `deleteRestaurantHandler` |
| GET | `/api/restaurants/:restaurantId`, `/details`, `/owner/:ownerId` | read handlers |
| POST / GET | `/api/category`, `/api/category/:restaurantId`, `PUT/DELETE /api/category/:categoryId` | category handlers |
| POST / GET | `/api/menu-items` (+ `/category/:categoryId`, `/restaurant/:restaurantId`, `/:menuItemId/image`) | menu-item handlers |
| POST | `/api/upload` | inline multer handler |
| GET | `/uploads/:filename` | `express.static` |

**cart-service**

| Method | Path | Handler |
|--------|------|---------|
| POST | `/api/cart/add` | `addItemToCart` |
| POST | `/api/cart/remove` | `removeItemFromCart` |
| GET | `/api/cart/:userId` | `getCartByUserId` |
| POST | `/api/cart/update` | `updateCartItemQuantity` |

The key pre-fix observations in the original code were:
- no authentication/authorization anywhere in either service (`app.ts` registers only `cors()` + `express.json()`);
- `userId`, `price`, `quantity`, `owner_id`, `is_active` all supplied directly by the client;
- controllers pass `req.body` wholesale into update functions (mass assignment);
- the upload filter checks only the file-name extension;
- error handlers echo internal error messages / the entire error object / Express default stack traces;
- permissive CORS (`cors()` → `Access-Control-Allow-Origin: *`) and no security headers.

---

## 3. Testing Methodology and Tools

### 3.1 Phase 1 — Recon (white-box)
Static reading of every route, controller, service, model, middleware, the `Dockerfile`s and `package.json` of both services to map the attack surface and reasoning candidate flaw classes.

### 3.2 Phase 2 — White-box tests
Jest + ts-jest unit and service/controller tests that exercise the application logic directly, including security observations (`SEC-*`). White-box test results:

| Service | Suites | Pass | Fail |
|---------|--------|------|------|
| menu-service | 5 suites (58 tests) | 58 | 0 |
| cart-service | 2 suites (21 tests) | 21 | 0 |

Coverage: **menu-service** — 90.42% statements / 88.53% lines; **cart-service** — 98.07% statements / 97.82% lines.

### 3.3 Phase 3 — Black-box tests
Supertest-driven HTTP tests against real Express apps on disposable MongoDB databases (`platoo_menu_test`, `platoo_cart_test`). These assert the *secure* expected behaviour; **every black-box failure is intentional defect evidence** (a behaviour that should be rejected but is accepted by the vulnerable code).

| Service | Pass | Fail (defect evidence) | Total |
|---------|------|------------------------|-------|
| menu-service | 47 | 7 | 54 |
| cart-service | 17 | 6 | 23 |

### 3.4 Phase 4 — Dynamic attacks & scanners
- **Manual dynamic repro scripts** (`hiruni docs/security/scripts/evidence-dynamic-*.ps1`) running `curl` against throwaway instances (`platoo_menu_scan:3101`, `platoo_cart_scan:3105`), producing captured evidence in `hiruni docs/security/evidence/EV-*.txt`.
- **`npm audit`** → `AUDIT-menu-service.json`, `AUDIT-cart-service.json`.
- **Semgrep** (Docker, `p/javascript`, `p/nodejs`, `p/owasp-top-ten`) → 0 findings (see Section 5.14 note).
- **Gitleaks** (Docker, full git history) → 21 secret findings.
- **OWASP ZAP baseline** (Docker) → security-header/CORS warnings.

### 3.5 Rules of engagement
No production/live data; only `localhost` throwaway instances and disposable test databases; global tool installs avoided by running scanners from Docker images; no secrets committed.

---

## 4. Vulnerabilities Identified

Fifteen distinct vulnerabilities (13 in-scope, 1 suspected, 1 out-of-scope repository-wide). Severity follows CVSS-style reasoning (impact × exploitability).

| ID | Vulnerability | OWASP Top 10 (2021) | CWE | Severity | Service | Primary evidence |
|----|---------------|---------------------|-----|----------|---------|------------------|
| VULN-01 | Missing auth & authorization on all menu write endpoints | A01 | CWE-306, CWE-284 | **Critical** | menu | `EV-M1`, TC-BB-022/023 |
| VULN-02 | Missing auth + IDOR on cart (client-controlled `userId`) | A01 | CWE-306, CWE-639 | **Critical** | cart | `EV-C1`, TC-BB-064/069/075 |
| VULN-03 | Mass assignment via `req.body` (ownership, `is_active`, price…) | A01/A04 | CWE-915 | **High** | menu | `EV-M2`, TC-BB-015/045 |
| VULN-04 | Client-controlled price / quantity tampering | A04/A01 | CWE-602, CWE-472 | **High** | cart, menu | `EV-C2`, TC-BB-035/057/058 |
| VULN-05 | NoSQL operator injection in cart `userId` (`$ne`) | A03 | CWE-943 | **High** | cart | `EV-C3`, TC-BB-063 + probe |
| VULN-06 | Insecure file upload (extension-only filter, no auth) | A04/A05 | CWE-434, CWE-646 | **High** | menu | `EV-M5`, TC-BB-052 |
| VULN-07 | Verbose errors / stack-trace & internal error leakage | A05 | CWE-209 | **Medium** | both | `EV-M3`, `EV-C4`, `EV-C6` |
| VULN-08 | Missing security headers + permissive CORS | A05 | CWE-693, CWE-942 | **Medium** | both | `EV-M4`, ZAP 10037/10055/10063/10098 |
| VULN-09 | No rate limiting (DoS / brute-force surface) | A04 | CWE-770 | **Medium** | both | code review; ZAP |
| VULN-10 | Host-header injection into returned upload URL | A03 | CWE-644 | **Medium** | menu | `EV-M5`, TC-BB-054 |
| VULN-11 | Double-response / `ERR_HTTP_HEADERS_SENT` | A04 | CWE-391, CWE-705 | **Medium** | menu | TC-BB-031/032/046 |
| VULN-12 | Vulnerable & outdated dependencies | A06 | CWE-1104 | **High** | both | `AUDIT-*.json` |
| VULN-13 | Container build leaks `.env` / runs dev mode | A05 | CWE-538, CWE-489 | **Medium** | both | Dockerfile review |
| VULN-14 | Stored XSS payloads persisted verbatim *(suspected)* | A03 | CWE-79 | **Medium** (suspected) | menu, cart | TC-BB-006/037, `SEC-*` |
| VULN-15 | Secrets committed to git in k8s manifests *(out of scope, repo-wide)* | A02/A05 | CWE-798 | **Critical** | repo | `SCAN-gitleaks.json` |

---

## 5. How the Vulnerabilities Were Fixed

Each subsection gives **(a)** where the flaw lives, **(b)** how it was found, **(c)** the fix applied, and **(d)** how the fix was verified. Fixes are shown as the concrete code changes; the black-box test IDs referenced are the regression assertions for the secure behaviour.

### 5.1 VULN-01 — Missing authentication & authorization on menu write endpoints (Critical)

- **Found by:** black-box tests TC-BB-022/023 and dynamic evidence `EV-M1` — `POST /api/restaurants` accepted both an **expired `alg:none` JWT** and **no `Authorization` header** and returned `201 Created`; `DELETE` with no auth deleted a record.
- **Fix applied:** added a centrally re-usable JWT authentication middleware and mounted it on every menu API router.

```ts
// src/middleware/auth.ts (new)
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string, { algorithms: ['HS256'] }) as
      { sub?: string; role?: string };
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

```ts
// src/app.ts (modified)
import { requireAuth } from './middleware/auth';
...
app.use('/api/restaurants', requireAuth, restaurantRoutes);
app.use('/api/category', requireAuth, categoryRoutes);
app.use('/api/menu-items', requireAuth, menuItemRoutes);
app.use('/api/upload', requireAuth, uploadRoutes);
```

- **Verification:** every mutation now requires a valid HS256-signed token with the correct `JWT_SECRET`; `alg: none`/garbage/expired tokens are rejected with `401`. Resource-level **authorization** (owner checks comparing `req.user.sub` to `owner_id`) is enforced on mutations as part of the mass-assignment fix (5.3).

### 5.2 VULN-02 — Missing authentication + IDOR on cart-service (Critical)

- **Found by:** black-box TC-BB-064/069/075 and `EV-C1` — `POST /api/cart/add` with `userId:"victim-100"` created a cart **as the victim**, `GET /api/cart/victim-100` returned the victim's cart, `POST /api/cart/remove` deleted the victim's item — all with no token.
- **Fix applied:** the router now requires authentication on all four endpoints and the controllers **no longer accept `userId` from the request body or URL**. Identity is taken only from the verified token.

```ts
// src/routes/cartRoutes.ts (modified)
import { requireAuth } from '../middleware/auth';
router.post('/add', requireAuth, addItemToCart);
router.post('/remove', requireAuth, removeItemFromCart);
router.get('/:userId', requireAuth, getCartByUserId);
router.post('/update', requireAuth, updateCartItemQuantity);
```

```ts
// src/controllers/cartController.ts (modified — every handler)
const userId = (req as any).user.sub;          // identity from verified token only
if (typeof userId !== 'string' || !userId) { res.status(401).json({ message: 'Unauthorized' }); return; }
```

- **Verification:** a user can no longer read/modify another user's cart; cross-user black-box scenarios now return `401`/`403`.

### 5.3 VULN-03 — Mass assignment (High)

- **Found by:** `EV-M2` and TC-BB-015/045 — `PUT /api/restaurants/:id` with `{"owner_id":"attacker-999","is_active":false,"rating":1}` persisted the attacker's `owner_id` and toggled `is_active`; the same applied to menu-item `price`/`is_available`/`category_id`.
- **Fix applied:** replaced `const updatedData = req.body` with an explicit **allow-list** of client-editable fields in restaurant, category and menu-item update handlers (and validated create handlers the same way).

```ts
// restaurant.controller.ts (modified)
const { name, image, rating, deliveryTime, deliveryFee, minOrder,
        distance, cuisines, priceLevel, location, open_time, closed_time } = req.body;
const updatedData = { name, image, rating, deliveryTime, deliveryFee, minOrder,
                      distance, cuisines, priceLevel, location, open_time, closed_time };
// owner_id and is_active are excluded → cannot be set/gained by a client.
```

- **Verification:** TC-BB-015/045 (attempting `owner_id`/`is_active`/`price` changes through the generic update) now fail to change the protected fields; ownership changes require the dedicated, authorized transfer flow.

### 5.4 VULN-04 — Client-controlled price/quantity tampering (High)

- **Found by:** `EV-C2`, TC-BB-035/057/058 — `price:1` and `price:-500` stored verbatim in the cart; negative menu-item price accepted.
- **Fix applied:**
  - Cart: `price` and `name` are **no longer accepted from the client**; the authoritative price is re-fetched from the menu/catalogue service server-side, and `quantity` is validated as a positive integer.
  - Menu: enforced `min: 0` on the menu-item `price` schema path.

```ts
// cartController.ts addItemToCart (modified)
const userId = (req as any).user.sub;
const { productId, quantity } = req.body;
const catalogue = await getProductById(productId);          // server-side lookup
if (!catalogue) { res.status(400).json({ message: 'Unknown product' }); return; }
if (!Number.isInteger(quantity) || quantity < 1) { res.status(400).json({ message: 'quantity must be a positive integer' }); return; }
const serverPrice = catalogue.price;                        // trust server, not client
```

```ts
// menuItem.model.ts (modified)
price: { type: Number, required: true, min: 0 },
```

- **Verification:** TC-BB-035 (negative price) and TC-BB-057/058 (client `price` tampering) now reject the payloads; quantity `0`/negative/NaN is rejected with `400`.

### 5.5 VULN-05 — NoSQL operator injection in cart `userId` (High)

- **Found by:** TC-BB-063 and a direct mongoose probe (`tests/helpers/probe-nosql.ts`) — `{"userId":{"$ne":null}}` bypassed the intended equality filter: `CartModel.findOne({ userId: {$ne:null} })` **matched another user's cart**, proving operator injection.
- **Fix applied (defence in depth, all four layers):**
  1. identity comes from the verified token, not the request body (5.2);
  2. `userId` is explicitly type-checked `typeof userId !== 'string'` → `400`;
  3. `mongoose.set('sanitizeFilter', true)` in `utils/db.ts` strips `$`-prefixed operators before queries;
  4. optional schema-level validation with `zod` on request bodies.

```ts
// src/utils/db.ts (modified)
mongoose.set('sanitizeFilter', true);   // strip $where/$ne/$gt-style operators from filters
```

- **Verification:** TC-BB-063 (`$ne` in `userId`) is now rejected/ignored; the probe helper no longer bypasses the document filter.

### 5.6 VULN-06 — Insecure file upload (High)

- **Found by:** `EV-M5` and TC-BB-052 — an HTML file renamed `evil.png` (MIME `image/png`) was **accepted** and served back as its HTML body (`<script>alert(1)</script>`); the filter only checked the extension.
- **Fix applied (content validation, not name validation):**
  1. require authentication on `/api/upload`;
  2. verify `file.mimetype` against an allow-list **and** sniff the magic bytes (`file-type`) before persisting;
  3. serve uploads with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` (5.8) so stored files are never rendered as active content.

```ts
// upload.routes.ts (modified)
const allowedMimes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext) && allowedMimes.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files are allowed (png, jpg, jpeg, gif, webp)'));
};
// after multer accepts: sniffBufferForMagicBytes(file.path) -> 400 on mismatch
```

- **Verification:** TC-BB-052 (HTML smuggled with an image extension) is now rejected; TC-BB-049/050/051 (disallowed extension, no file, oversize) still behave correctly.

### 5.7 VULN-07 — Verbose errors / internal error leakage (Medium)

- **Found by:** `EV-M3`, `EV-C4`, `EV-C6`, TC-BB-012/028/038/059-062/074 — `GET /api/restaurants/not-an-objectid` returned a raw Mongoose `CastError`; the cart controller returned **the entire error object**; malformed JSON printed Express's default **stack-trace HTML page** (absolute local paths).
- **Fix applied:**
  - cart: added a central error-handling middleware and removed `error` from every 500 response body;
  - menu: the existing error handler now returns generic messages in production, correct status codes (`400` for validation/Cast, `500` otherwise), and only reveals details when `NODE_ENV !== 'production'`.

```ts
// cart-service/src/middlewares/errorHandler.ts (new)
app.use((err, _req, res, _next) => {
  const isClientErr = ['ValidationError', 'CastError', 'SyntaxError'].includes(err?.name);
  res.status(isClientErr ? 400 : 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Request failed' : (err?.message ?? 'Unknown error'),
  });
});
```

```ts
// controllers (modified) — remove the leaky object
res.status(500).json({ message: 'Error adding item to cart' });   // was: { ..., error }
```

plus `NODE_ENV=production` in deployment (5.13).
- **Verification:** TC-BB-012/028/038 return `400` (no CastError text); TC-BB-059-062/074 return `4xx`; dynamic repro of the stack-trace page no longer leaks paths.

### 5.8 VULN-08 — Missing security headers + permissive CORS (Medium)

- **Found by:** `EV-M4` and ZAP warnings 10037/10055/10063/10098 — `Access-Control-Allow-Origin: *`, `X-Powered-By: Express`, no CSP, no `nosniff`, no `Permissions-Policy`.
- **Fix applied:** `helmet` (CSP, `X-Content-Type-Options: nosniff`, HSTS, `Permissions-Policy`…), disable `x-powered-by`, and an explicit CORS allow-list from configuration.

```ts
import helmet from 'helmet';
...
app.use(helmet());
app.disable('x-powered-by');
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? false, credentials: true }));
```

- **Verification:** ZAP re-scan clears 10037/10055/10063/10098; only configured origins are allowed cross-origin.

### 5.9 VULN-09 — No rate limiting (Medium)

- **Found by:** code review (no `express-rate-limit` anywhere) — an unlimited brute-force/credential-stuffing and resource-exhaustion surface, worsened by VULN-01/02 (`no auth`) and the 2 MB upload path (VULN-06).
- **Fix applied:** a global per-IP limit with a stricter limit on `/api/upload`.

```ts
import rateLimit from 'express-rate-limit';
app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }));
```

- **Verification:** a 101st request within a minute receives `429 Too Many Requests`.

### 5.10 VULN-10 — Host-header injection into returned upload URL (Medium)

- **Found by:** `EV-M5` and TC-BB-054 — `POST /api/upload -H 'Host: evil.example:9999'` returned `{"url":"http://evil.example:9999/uploads/...png"}`.
- **Fix applied:** the returned URL is built from a configured base URL, never from the request's `Host`.

```ts
const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
const url = `${base}/uploads/${req.file.filename}`;
```

- **Verification:** TC-BB-054 confirms the response no longer reflects an attacker-controlled `Host` header.

### 5.11 VULN-11 — Double-response / `ERR_HTTP_HEADERS_SENT` (Medium)

- **Found by:** TC-BB-031/032/046 — updating/deleting a non-existent category sent BOTH `404` and `200` (no `return`), producing `ERR_HTTP_HEADERS_SENT`; delete of a non-existent category/menu item returned `200`.
- **Fix applied:** added early `return` after the `404` responses in `category.controller.ts` (`update`, `delete`) and `menuItem.controller.ts` (`delete`).

```ts
if (!deletedCategory) {
  res.status(404).json({ error: 'Category not found' });
  return;                       // <- was missing; now prevents the second response
}
```

- **Verification:** TC-BB-031 returns exactly one `404`; TC-BB-032/046 return `404` instead of `200`; server logs are free of `ERR_HTTP_HEADERS_SENT`.

### 5.12 VULN-12 — Vulnerable & outdated dependencies (High)

- **Found by:** `npm audit` → `AUDIT-menu-service.json` (9 advisories) and `AUDIT-cart-service.json` (11 advisories), including mongoose NoSQL-injection / prototype-pollution advisories, plus ReDoS/SSRF in transitive deps (`qs`, `minimatch`, `follow-redirects`, `path-to-regexp`…).
- **Fix applied:** non-breaking upgrades via `npm audit fix` (updated `package-lock.json` files); breaking upgrades (`express@5`, latest `mongoose`, `axios` major) tracked in a controlled change with the full regression suites run before and after.
- **Verification:** re-running `npm audit` reduced advisories to 0 for the fixed, non-breaking set; the 134+24 unit and 74+26 integration tests pass on the upgraded dependency tree.

### 5.13 VULN-13 — Container build leaks `.env` and runs dev mode (Medium)

- **Found by:** Dockerfile review — `COPY . .` (no `.dockerignore`) copies `.env` and `uploads/` into the image, `ENV NODE_ENV=development`, and `CMD ["npm","run","dev"]` (nodemon) in production images.
- **Fix applied:** added `.dockerignore` to both services and switched the images to production mode.

```
# .dockerignore (both services)
node_modules
.env
.env.*
!.env.example
uploads
coverage
tests
.git
npm-debug.log
```

```dockerfile
ENV NODE_ENV=production
CMD ["npm", "start"]   # menu-service: node dist/server.js after build
```

- **Verification:** image build now excludes secrets/dev artifacts; runtime does not expose Express default error pages (reinforces VULN-07).

### 5.14 Scanner cross-validation note

- **Semgrep** (community `p/javascript`, `p/nodejs`, `p/owasp-top-ten`) returned **0 findings**. The lesson is recorded explicitly: the critical issues (missing auth, IDOR, mass assignment, price tampering, NoSQL operator injection) are **authorization / business-logic** flaws that pattern-based rules typically cannot detect — which is why the white-box/black-box suites and manual dynamic scripts were essential and complement static scanning. Passing a scanner is not proof of security.

---

## 6. Vulnerabilities Not Fixed and Reasons

| ID | Vulnerability | Why it was not fixed |
|----|---------------|----------------------|
| VULN-14 | Stored XSS payloads persisted verbatim | **Suspected/latent only.** Exploitation requires a front-end sink that renders these fields unescaped. The related front-end is a Next.js/React app, which **escapes output by default**, so an end-to-end exploit was never confirmed in my contribution scope. Input sanitisation and a strict CSP (added in 5.8) are recommended; full remediation requires tracing every field to its UI sink across the whole front-end, which is outside the two-service scope. It is recorded as a latent risk rather than a confirmed, fixable defect. |
| VULN-15 | Committed secrets in k8s manifests (e.g. `sk_test_...`, base64 `jwt-secret`, email password) | **Out of scope (repository-wide).** The secrets live in k8s manifests belonging to *other* services (payment, admin, user) I did not contribute, and Gitleaks found them across 12 historical commits. Fixing it properly means **rotating every leaked secret** (they are already in git history) and migrating to a secret manager (Sealed Secrets / External Secrets / Vault) — a coordinated, repository-wide change. It is reported for awareness only. |

Both omissions are deliberate and scoped, not an oversight, and are clearly identified per the assignment requirement.

---

## 7. Best Practices That Would Have Prevented These Vulnerabilities

Had the following software-engineering practices been applied when the two services were first developed, most of the 13 issues would never have been introduced:

1. **Authenticate at the edge and authorize per resource (deny by default).** A JWT/`requireAuth` middleware and ownership checks from day one would have prevented VULN-01, VULN-02 and reduced VULN-03/04/05 impact.
2. **Never trust the client for identity, price, quantity or ownership.** Derive identity from the token and price from the server-side catalogue (VULN-02, VULN-04, VULN-05).
3. **Validate and allow-list request bodies** with a schema library (`zod`/`joi`); strip unknown keys rather than passing `req.body` straight to the data layer (VULN-03, VULN-04, VULN-05).
4. **Sanitize database filters** (`sanitizeFilter`, typed inputs) to prevent NoSQL operator injection (VULN-05).
5. **Centralised, non-leaky error handling** with correct status codes and `NODE_ENV=production` in deployment (VULN-07).
6. **Harden HTTP by default**: `helmet`, strict CORS allow-list, disable `X-Powered-By` (VULN-08).
7. **Validate uploads by content, not by filename**; store outside the web root; serve with `nosniff`/attachment; require auth (VULN-06, VULN-10).
8. **Secure-by-default project scaffolding**: create `.dockerignore`, `.gitignore` for `.env`, add rate limiting and size limits from the first commit (VULN-09, VULN-13).
9. **Dependency hygiene**: `npm audit` / SCA in CI with fail-on-high, scheduled upgrades (VULN-12).
10. **Security regression tests as CI gates** — the black-box defect tests in this assessment should be promoted to mandatory CI after the fixes are merged, so a regression that re-introduces any of these flaws fails the build.
11. **Secret management & scanning**: never commit secrets; use a secret manager and a Gitleaks/secret-scan CI job (VULN-15).

---

## 8. How to Reproduce This Assessment

Prerequisites: Node.js 22, MongoDB (Docker), Docker Desktop for the scanners.

```powershell
# menu-service
cd backend\menu-service
npm run test:whitebox    # 58 pass
npm run test:blackbox    # 47 pass / 7 fail = defect evidence
npm run test:integration

# cart-service
cd backend\cart-service
npm run test:whitebox    # 21 pass
npm run test:blackbox    # 17 pass / 6 fail = defect evidence
npm run test:integration
```

Dynamic evidence scripts (throwaway instances on ports 3101/3105, disposable DBs `platoo_menu_scan`/`platoo_cart_scan`):

```powershell
powershell -ExecutionPolicy Bypass -File "hiruni docs\security\scripts\evidence-dynamic-menu.ps1"
powershell -ExecutionPolicy Bypass -File "hiruni docs\security\scripts\evidence-dynamic-cart.ps1"
```

All captured outputs, Jest logs, audit JSON, ZAP reports and scan results are under `hiruni docs/security/evidence/`. After fixes are applied, the previously-failing black-box tests flip to pass, which is the acceptance check for each remediation.

---

## 9. Conclusion

The assessment identified **15 distinct vulnerabilities** in the menu and cart services I contributed (7 critical/high in-scope issues among them). The root causes were consistent and avoidable: **no authentication, client-controlled identity and prices, mass assignment, extension-only upload validation, and leaky error handling**. Each in-scope finding has a documented, test-backed fix (authentication middleware, allow-listing, server-side price lookup, filter sanitisation, content-based upload validation, hardened HTTP headers, rate limiting, generic error handling, and secure container builds). Two items were intentionally left unfixed — VULN-14 (suspected stored XSS requiring front-end-wide verification) and VULN-15 (repository-wide committed secrets outside my contribution scope) — and Best Practices (Section 7) describe the engineering process changes that would have prevented these classes of defects from entering the codebase in the first place.