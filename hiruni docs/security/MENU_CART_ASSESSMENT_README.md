# Security Assessment — Platoo `menu-service` & `cart-service`

**Course:** SE4030 — Secure Software Development
**Assessment type:** Grey-box security assessment (recon → functional testing → vulnerability assessment)
**Date of assessment:** 2026-09-21
**Assessor:** _(student)_
**Deliverable status:** Assessment complete. **No application source code was modified and no vulnerabilities were fixed** — this report only documents findings and proposes fixes.

---

## 1. Scope

### 1.1 In scope

| # | Service | Path | Language / Runtime | Default port | Database |
|---|---------|------|--------------------|--------------|----------|
| 1 | `menu-service` | `backend/menu-service` | Node.js + Express + Mongoose (TypeScript) | 3001 | `platoo_menu` |
| 2 | `cart-service` | `backend/cart-service` | Node.js + Express + Mongoose (TypeScript) | 3005 | `platoo_cart` |

Assessed artifacts: HTTP API surface, route/controller/service/model code, upload handling, error handling, CORS/security headers, authentication/authorization, dependency tree, container build config.

### 1.2 Out of scope

- All other microservices (user, admin, delivery, notification, payment, order, etc.).
- Front-end / mobile clients (no rendering-side verification was performed).
- Infrastructure (Kubernetes, reverse proxy, network segmentation) except where it directly affects the two services.
- Denial-of-service load testing (only lightweight, non-destructive checks were performed).
- Live/production data. **All testing used dedicated, throwaway databases.**

### 1.3 Assessment constraints (agreed rules of engagement)

- No source code changes to the application (tests/scripts/docs only).
- No fixes applied yet.
- Never commit secrets; never touch real data.
- Global tool installation requires approval (all third-party scanners were run from Docker images instead).
- The only hosts contacted were `localhost` instances started for this assessment and Docker image registries.

---

## 2. Environment

| Item | Value |
|------|-------|
| OS | Windows 11 (win32) |
| Shell | Windows PowerShell 5.1 |
| Node.js | v22.18.0 |
| npm | 10.9.3 |
| Docker | 29.1.5 |
| MongoDB | Docker container, `mongodb://127.0.0.1:27017` |
| Redis | Docker container |
| HTTP client | `curl.exe` 8.21 |
| Test runner | Jest 29 + ts-jest 29 + Supertest 7 |

### 2.1 Databases used (all disposable)

| Database | Purpose |
|----------|---------|
| `platoo_menu_test` / `platoo_cart_test` | Jest functional/white-box tests (dropped & recreated by tests) |
| `platoo_menu_scan` / `platoo_cart_scan` | Temporary instances used for dynamic evidence capture & ZAP |

### 2.2 Temporary assessment instances

Two throwaway instances were started **solely for this assessment** (they are separate from any developer instance):

| Instance | Command (run from the service dir) | URL | DB |
|----------|------------------------------------|-----|----|
| menu scan | `PORT=3101 MONGODB_URI=mongodb://127.0.0.1:27017/platoo_menu_scan npx ts-node src/server.ts` | `http://localhost:3101` | `platoo_menu_scan` |
| cart scan | `PORT=3105 MONGODB_URI=mongodb://127.0.0.1:27017/platoo_cart_scan npx ts-node src/server.ts` | `http://localhost:3105` | `platoo_cart_scan` |

---

## 3. Baseline

| Item | Value |
|------|-------|
| Repository | `Platoo-updated` |
| Branch | `security-assessment-menu-cart` |
| Baseline commit (HEAD at start) | `7d6479f550df54ffc68eb9005a5adc4c9652066b` |
| Baseline commit date | 2026-09-16 17:01:56 +0530 |
| Working tree at baseline | clean |

All findings below were reproduced against code at the baseline commit. Test/script/doc files added by this assessment do not alter application behaviour.

---

## 4. API Endpoint Inventory

### 4.1 `menu-service` (`/api/...`)

| Method | Path | Handler | Auth required? | Notes |
|--------|------|---------|----------------|-------|
| POST | `/api/restaurants` | `createRestaurantHandler` | **No** | `owner_id` supplied by client |
| GET | `/api/restaurants` | `getRestaurantsHandler` | No | list all |
| PUT | `/api/restaurants/:restaurantId` | `updateRestaurantHandler` | **No** | passes `req.body` straight through |
| PATCH | `/api/restaurants/:restaurantId/owner` | `updateRestaurantOwnerHandler` | **No** | can reassign ownership |
| DELETE | `/api/restaurants/:restaurantId` | `deleteRestaurantHandler` | **No** | destructive |
| GET | `/api/restaurants/:restaurantId` | `getRestaurantByIdHandler` | No | |
| GET | `/api/restaurants/:restaurantId/details` | `getRestaurantWithCategoriesAndMenuItemsHandler` | No | |
| GET | `/api/restaurants/owner/:ownerId` | `getRestaurantsByOwnerIdHandler` | No | |
| POST | `/api/category` | `createCategoryHandler` | **No** | |
| GET | `/api/category` | `getAllCategoriesHandler` | No | |
| GET | `/api/category/:restaurantId` | `getCategoriesByRestaurantHandler` | No | |
| PUT | `/api/category/:categoryId` | `updateCategoryHandler` | **No** | double-response bug |
| DELETE | `/api/category/:categoryId` | `deleteCategoryHandler` | **No** | double-response bug |
| POST | `/api/menu-items` | `createMenuItemHandler` | **No** | |
| GET | `/api/menu-items` | `getAllMenuItemsHandler` | No | |
| GET | `/api/menu-items/category/:categoryId` | `getMenuItemsByCategoryHandler` | No | |
| GET | `/api/menu-items/restaurant/:restaurantId` | `getMenuItemsByRestaurantHandler` | No | |
| GET | `/api/menu-items/:menuItemId/image` | `getMenuItemImageHandler` | No | |
| PUT | `/api/menu-items/:menuItemId` | `updateMenuItemHandler` | **No** | |
| DELETE | `/api/menu-items/:menuItemId` | `deleteMenuItemHandler` | **No** | |
| POST | `/api/upload` | inline multer handler | **No** | field name `file` |
| GET | `/uploads/:filename` | `express.static` | No | serves uploaded files |

### 4.2 `cart-service` (`/api/cart/...`)

| Method | Path | Handler | Auth required? | Notes |
|--------|------|---------|----------------|-------|
| POST | `/api/cart/add` | `addItemToCart` | **No** | `userId`, `price`, `quantity` from client |
| POST | `/api/cart/remove` | `removeItemFromCart` | **No** | |
| GET | `/api/cart/:userId` | `getCartByUserId` | **No** | IDOR: any `userId` readable |
| POST | `/api/cart/update` | `updateCartItemQuantity` | **No** | |

---

## 5. Tools & Methodology

### 5.1 Methodology

1. **Recon (Phase 1)** — static reading of routes/controllers/services/models/middleware, `package.json`, `Dockerfile`, `.env.example`.
2. **Functional testing (Phase 2)** — black-box (HTTP via Supertest) and white-box (unit/service/controller) tests with coverage.
3. **Vulnerability assessment (Phase 3)** — dynamic reproduction scripts, dependency audit, static analysis, secret scanning, passive web scan.

### 5.2 Tools used

| Tool | Version/Source | How it was run | Output |
|------|----------------|----------------|--------|
| Jest + ts-jest + Supertest | 29 / 7 | `npm run test:*` (local devDeps) | `hiruni docs/security/evidence/TEST-*.txt` |
| `npm audit` | npm 10.9.3 | `npm audit --json` | `AUDIT-*.json` |
| Semgrep | `returntocorp/semgrep:latest` | Docker | `SCAN-semgrep-*.json` |
| Gitleaks | `zricethezav/gitleaks:latest` | Docker (git history) | `SCAN-gitleaks.json` |
| OWASP ZAP (baseline) | `ghcr.io/zaproxy/zaproxy:stable` | Docker | `ZAP-*.json`, `ZAP-*.html` |
| Manual HTTP | `curl.exe` | PowerShell scripts | `EV-*.txt` |

> **Note on ZAP coverage:** the baseline spider starts at `/` and follows links; the API has no HTML index, so ZAP's passive scan mainly reached `/`, `/robots.txt`, `/sitemap.xml`. It reliably detected **missing security headers / CORS misconfiguration**, but the authorization, IDOR, injection and upload issues were covered by the purpose-built dynamic scripts and the Jest suites. This limitation is stated explicitly rather than over-claiming scanner coverage.

---

## 6. Functional Testing Results

### 6.1 Test file inventory

| Service | Suite | File | Test IDs | Tests |
|---------|-------|------|----------|-------|
| menu | black-box | `tests/blackbox/restaurants.blackbox.test.ts` | TC-BB-001…023 | 23 |
| menu | black-box | `tests/blackbox/categories.blackbox.test.ts` | TC-BB-024…032 | 9 |
| menu | black-box | `tests/blackbox/menuItems.blackbox.test.ts` | TC-BB-033…047 | 15 |
| menu | black-box | `tests/blackbox/upload.blackbox.test.ts` | TC-BB-048…054 | 7 |
| menu | white-box | `tests/whitebox/restaurant.service.whitebox.test.ts` | WB-001…013 | 13 |
| menu | white-box | `tests/whitebox/menuItem.category.service.whitebox.test.ts` | WB-014…031 | 18 |
| menu | white-box | `tests/whitebox/controllers.whitebox.test.ts` | WB-032…046 | 15 |
| menu | white-box | `tests/whitebox/upload.whitebox.test.ts` | WB-047…053 | 7 |
| menu | white-box | `tests/whitebox/security.observation.whitebox.test.ts` | SEC-001…005 | 5 |
| cart | black-box | `tests/blackbox/cart.blackbox.test.ts` | TC-BB-055…077 | 23 |
| cart | white-box | `tests/whitebox/cartController.whitebox.test.ts` | WB-054…070 | 17 |
| cart | white-box | `tests/whitebox/security.observation.whitebox.test.ts` | SEC-006…009 | 4 |

### 6.2 Execution summary

| Service | Suite | Suites | Tests passed | Tests failed | Total |
|---------|-------|--------|--------------|--------------|-------|
| menu | white-box | 5 passed | 58 | 0 | 58 |
| menu | black-box | 3 failed / 1 passed | 47 | 7 | 54 |
| cart | white-box | 2 passed | 21 | 0 | 21 |
| cart | black-box | 1 failed | 17 | 6 | 23 |

**Totals:** 156 tests (143 passed, 13 failed). Every failure is an **intentional assertion that a defect exists** (the test expects the secure behaviour; the observed behaviour is the defect). They are evidence, not broken tests.

### 6.3 Failed black-box tests (defect evidence)

| Test ID | Scenario | Expected | Observed | Maps to |
|---------|----------|----------|----------|---------|
| TC-BB-004 | `name` given as number | 400 | 201 created | VULN-07 (no type validation) |
| TC-BB-012 | Non-ObjectId `restaurantId` | 400 | 500 CastError leak | VULN-07 |
| TC-BB-028 | Non-ObjectId restaurant id (category) | 400 | 500 CastError leak | VULN-07 |
| TC-BB-031 | Update non-existent category | 404 | 500 / `ERR_HTTP_HEADERS_SENT` | VULN-11 |
| TC-BB-032 | Delete non-existent category | 404 | 200 success | VULN-11 |
| TC-BB-038 | Non-ObjectId `category_id` | 400 | 500 CastError leak | VULN-07 |
| TC-BB-046 | Delete non-existent menu item | 404 | 200 success | VULN-11 |
| TC-BB-059 | Cart quantity `0` | 4xx | 500 | VULN-07 |
| TC-BB-060 | Cart quantity string | 4xx | 200 accepted | VULN-07 |
| TC-BB-061 | Cart item missing `name` | 400 | 500 | VULN-07 |
| TC-BB-062 | Empty cart body | 400 | 500 | VULN-07 |
| TC-BB-063 | `$ne` operator in `userId` | rejected | 200 → another user's cart | VULN-05 |
| TC-BB-074 | Update cart quantity to `0` | 4xx | 500 | VULN-07 |

### 6.4 Coverage

**menu-service** — `All files 90.42% stmts / 54.83% branch / 98.82% funcs / 88.53% lines`

| File | % Stmts | % Branch | % Funcs | % Lines |
|------|---------|----------|---------|---------|
| app.ts | 100 | 50 | 100 | 100 |
| category.controller.ts | 88.67 | 58.33 | 100 | 86.04 |
| menuItem.controller.ts | 83.13 | 52.17 | 100 | 79.71 |
| restaurant.controller.ts | 85.41 | 47.36 | 100 | 82.71 |
| models (all) | 100 | 100 | 100 | 100 |
| routes (all) | 100 | 100 | 100 | 100 |
| upload.routes.ts | 96.29 | 75 | 100 | 96.29 |
| category.service.ts | 95.83 | 100 | 100 | 92.85 |
| menuItem.service.ts | 93.33 | 100 | 100 | 90 |
| restaurant.service.ts | 95 | 100 | 93.33 | 96 |

**cart-service** — `All files 98.07% stmts / 88.88% branch / 100% funcs / 97.82% lines`

| File | % Stmts | % Branch | % Funcs | % Lines |
|------|---------|----------|---------|---------|
| app.ts | 100 | 100 | 100 | 100 |
| cartController.ts | 100 | 100 | 100 | 100 |
| cartModel.ts | 100 | 100 | 100 | 100 |
| cartRoutes.ts | 100 | 100 | 100 | 100 |
| db.ts | 81.81 | 50 | 100 | 80 |

> `server.ts` and `utils/db.ts` are partially/not covered because tests import `app` directly rather than the server entry point (standard practice). This is expected and does not hide application logic.

---

## 7. Vulnerability Register

Severity is assigned with CVSS-style reasoning (impact × exploitability). All items below were **confirmed** unless marked *(suspected)*.

| ID | Vulnerability | OWASP Top 10 (2021) | CWE | Severity | Service | Evidence |
|----|---------------|---------------------|-----|----------|---------|----------|
| VULN-01 | Missing authentication & authorization on all menu write endpoints | A01 | CWE-306, CWE-284 | **Critical** | menu | EV-M1, TC-BB-022/023 |
| VULN-02 | Missing authentication + IDOR on cart (client-controlled `userId`) | A01 | CWE-306, CWE-639 | **Critical** | cart | EV-C1, TC-BB-064/069/075 |
| VULN-03 | Mass assignment via `req.body` (ownership, `is_active`, price…) | A01/A04 | CWE-915 | **High** | menu | EV-M2, TC-BB-015/045 |
| VULN-04 | Client-controlled price / quantity tampering | A04/A01 | CWE-602, CWE-472 | **High** | cart, menu | EV-C2, TC-BB-035/057/058 |
| VULN-05 | NoSQL operator injection in cart `userId` (`$ne`) | A03 | CWE-943 | **High** | cart | EV-C3, TC-BB-063, probe |
| VULN-06 | Insecure file upload (extension-only filter, no auth) | A04/A05 | CWE-434, CWE-646 | **High** | menu | EV-M5, TC-BB-052 |
| VULN-07 | Verbose errors / stack-trace & internal error leakage | A05 | CWE-209 | **Medium** | both | EV-M3, EV-C4, EV-C6, TC-BB-012/028/038/059-062/074 |
| VULN-08 | Missing security headers + permissive CORS | A05 | CWE-693, CWE-942 | **Medium** | both | EV-M4, ZAP (10037/10055/10063/10098) |
| VULN-09 | No rate limiting (DoS / brute-force surface) | A04 | CWE-770 | **Medium** | both | Code review; ZAP informational |
| VULN-10 | Host header injection into returned upload URL | A03 | CWE-644 | **Medium** | menu | EV-M5, TC-BB-054 |
| VULN-11 | Double-response / unhandled `ERR_HTTP_HEADERS_SENT` | A04 | CWE-391, CWE-705 | **Medium** | menu | TC-BB-031/032/046 |
| VULN-12 | Vulnerable & outdated dependencies | A06 | CWE-1104 | **High** | both | `AUDIT-*.json` |
| VULN-13 | Container build leaks `.env` / dev mode (`COPY . .`, no `.dockerignore`, `NODE_ENV=development`) | A05 | CWE-538, CWE-489 | **Medium** | both | Dockerfile review |
| VULN-14 | Stored XSS payloads persisted verbatim *(suspected — needs front-end sink)* | A03 | CWE-79 | **Medium** *(suspected)* | menu, cart | TC-BB-006/037, SEC-001… |
| VULN-15 | Secrets committed to git in k8s manifests **(out of scope, repository-wide)** | A02/A05 | CWE-798 | **Critical** | repo | `SCAN-gitleaks.json` |

---

## 8. Detailed Findings

> Each finding lists the vulnerable location, the reproduction, the impact, and a **proposed fix shown as a diff. Diffs are NOT applied.**

### VULN-01 — Missing authentication & authorization on menu write endpoints (Critical)

**Location:** `backend/menu-service/src/routes/*.routes.ts` (all routes), `src/app.ts:1-22`.
There is no authentication middleware anywhere in the service. Every route, including `POST`, `PUT`, `PATCH`, `DELETE`, is reachable with no `Authorization` header or with an arbitrary/invalid Bearer token.

**Reproduction:** `hiruni docs/security/evidence/EV-M1-menu-noauth-crud.txt`
- `POST /api/restaurants` with an expired `alg:none` JWT → **201 Created**.
- `POST /api/restaurants` with no auth header → **201 Created**.
- `DELETE /api/restaurants/:id` with no auth → **200** and the record is deleted.

**Impact:** Complete unauthenticated takeover of the menu domain: anyone can create/modify/delete restaurants, categories and menu items, and reassign ownership. This is the highest-impact issue and underpins several others.

**Proposed fix (NOT applied):**
```diff
--- a/backend/menu-service/src/app.ts
+++ b/backend/menu-service/src/app.ts
@@
 import uploadRoutes from './routes/upload.routes';
+import { requireAuth } from './middleware/auth';
 const cors = require("cors");
 const app = express();
 
 app.use(cors());
 app.use(express.json());
 
 app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
-app.use('/api/restaurants', restaurantRoutes);
-app.use('/api/category', categoryRoutes);
-app.use('/api/menu-items', menuItemRoutes);
-app.use('/api/upload', uploadRoutes);
+app.use('/api/restaurants', requireAuth, restaurantRoutes);
+app.use('/api/category', requireAuth, categoryRoutes);
+app.use('/api/menu-items', requireAuth, menuItemRoutes);
+app.use('/api/upload', requireAuth, uploadRoutes);
```
```diff
--- /dev/null
+++ b/backend/menu-service/src/middleware/auth.ts
+import { Request, Response, NextFunction } from 'express';
+import jwt from 'jsonwebtoken';
+
+export function requireAuth(req: Request, res: Response, next: NextFunction) {
+  const header = req.headers.authorization || '';
+  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
+  if (!token) return res.status(401).json({ error: 'Authentication required' });
+  try {
+    const payload = jwt.verify(token, process.env.JWT_SECRET as string, {
+      algorithms: ['HS256'],
+    }) as { sub?: string; role?: string };
+    (req as any).user = payload;
+    next();
+  } catch {
+    return res.status(401).json({ error: 'Invalid or expired token' });
+  }
+}
```
Additionally, **read-only** endpoints may be left public if intended, but ownership checks must be enforced on mutations (compare `req.user.sub` to the resource's `owner_id`).

---

### VULN-02 — Missing authentication + IDOR on cart-service (Critical)

**Location:** `backend/cart-service/src/controllers/cartController.ts:5-111`, `src/routes/cartRoutes.ts`.
The user identity is taken entirely from the request body/URL (`req.body.userId`, `req.params.userId`). No token is validated (`app.ts` registers no auth middleware).

**Reproduction:** `hiruni docs/security/evidence/EV-C1-cart-idor.txt`
- `POST /api/cart/add` with `userId:"victim-100"` creates a cart **as the victim**, no auth.
- `GET /api/cart/victim-100` returns the victim's cart contents, no auth.
- `POST /api/cart/remove` with `userId:"victim-100"` deletes the victim's item.

**Impact:** Any user can read, add to, modify or empty any other user's cart (privacy + integrity + business fraud). Combined with VULN-04, an attacker can manipulate what a victim is charged.

**Proposed fix (NOT applied):**
```diff
--- a/backend/cart-service/src/routes/cartRoutes.ts
+++ b/backend/cart-service/src/routes/cartRoutes.ts
@@
 import { Router } from 'express';
+import { requireAuth } from '../middleware/auth';
@@
-router.post('/add', addItemToCart);
-router.post('/remove', removeItemFromCart);
-router.get('/:userId', getCartByUserId);
-router.post('/update', updateCartItemQuantity);
+router.post('/add', requireAuth, addItemToCart);
+router.post('/remove', requireAuth, removeItemFromCart);
+router.get('/:userId', requireAuth, getCartByUserId);
+router.post('/update', requireAuth, updateCartItemQuantity);
```
```diff
--- a/backend/cart-service/src/controllers/cartController.ts
+++ b/backend/cart-service/src/controllers/cartController.ts
@@
 export const addItemToCart = async (req: Request, res: Response): Promise<void> => {
-  const { userId, productId, name, price, quantity, image } = req.body;
+  const userId = (req as any).user.sub;            // identity from verified token
+  if (!userId) { res.status(401).json({ message: 'Unauthorized' }); return; }
+  const { productId, name, quantity, image } = req.body;
+  // price is NOT accepted from the client; it must be looked up server-side.
```
(and equivalently ignore any client-supplied `userId` in `remove`/`get`/`update`).

---

### VULN-03 — Mass assignment (High)

**Location:** `backend/menu-service/src/controllers/restaurant.controller.ts:59-78` (`const updatedData = req.body;` → `updateRestaurant`), `:13-42`, `category.controller.ts:39-57`, `menuItem.controller.ts` update handler.

**Reproduction:** `hiruni docs/security/evidence/EV-M2-menu-mass-assignment.txt`
- `PUT /api/restaurants/:id` with `{"owner_id":"attacker-999","is_active":false,"rating":1}` persists the attacker-chosen `owner_id` and toggles `is_active`.
- TC-BB-015 confirms `owner_id`/`is_active` can be changed through the generic PUT.
- TC-BB-045 confirms `is_available`, `price`, `category_id` can be changed on a menu item.

**Impact:** An attacker can seize ownership of any restaurant (`owner_id`), hide/show listings (`is_active`), and rewrite prices.

**Proposed fix (NOT applied):**
```diff
--- a/backend/menu-service/src/controllers/restaurant.controller.ts
+++ b/backend/menu-service/src/controllers/restaurant.controller.ts
@@
 export const updateRestaurantHandler = async (req: Request, res: Response): Promise<void> => {
   try {
     const { restaurantId } = req.params;
-    const updatedData = req.body;
+    // Allow-list of client-editable fields only.
+    const { name, image, rating, deliveryTime, deliveryFee, minOrder,
+            distance, cuisines, priceLevel, location, open_time, closed_time } = req.body;
+    const updatedData = { name, image, rating, deliveryTime, deliveryFee, minOrder,
+            distance, cuisines, priceLevel, location, open_time, closed_time };
```
Apply the same allow-listing to category and menu-item update handlers. Ownership (`owner_id`) must never be client-settable except through a dedicated, authorized transfer flow.

---

### VULN-04 — Client-controlled price / quantity tampering (High)

**Location:** `cartController.ts:6,20` (`price`, `quantity` from body); `menu-service` menu-item create/update accepts client `price`.

**Reproduction:** `hiruni docs/security/evidence/EV-C2-cart-price-tamper.txt`
- `POST /api/cart/add` with `price:1` and `price:-500` — both stored verbatim.
- TC-BB-035: negative menu-item price accepted.
- TC-BB-057/058: cart price stored verbatim / negative accepted.

**Impact:** Users can set the price they pay; negative prices could invert totals/refunds depending on downstream order logic.

**Proposed fix (NOT applied):**
```diff
--- a/backend/cart-service/src/controllers/cartController.ts
+++ b/backend/cart-service/src/controllers/cartController.ts
@@
-    if (existingItem) {
-      existingItem.quantity += quantity;
-    } else {
-      cart.items.push({ productId, name, price, quantity, image });
-    }
+    // Re-fetch authoritative price from the menu service / catalogue.
+    const catalogue = await getProductById(productId);
+    if (!catalogue) { res.status(400).json({ message: 'Unknown product' }); return; }
+    const serverPrice = catalogue.price;
+    if (!Number.isInteger(quantity) || quantity < 1) {
+      res.status(400).json({ message: 'quantity must be a positive integer' }); return;
+    }
+    if (existingItem) {
+      existingItem.quantity += quantity;
+    } else {
+      cart.items.push({ productId, name: catalogue.name, price: serverPrice, quantity, image });
+    }
```
Also add `min: 0` to the menu-item `price` schema path.

---

### VULN-05 — NoSQL operator injection in cart `userId` (High)

**Location:** `cartController.ts:9,39,65,85` — `CartModel.findOne({ userId })` where `userId` is attacker-controlled.

**Reproduction:** `hiruni docs/security/evidence/EV-C3-cart-nosql-injection.txt` + direct probe.
- Seed a victim cart, then send `{"userId":{"$ne":null},...}` to `POST /api/cart/add`.
- The `$ne` operator bypasses the intended exact-match filter and **matches/updates the first cart in the collection** (the victim's), appending the attacker's item.
- When no cart exists, the same input reaches `new CartModel({ userId: {$ne:null} })` and produces a `CastError` (500).

A direct mongoose probe confirmed the operator is evaluated as a query operator while a matching document exists:
```
findOne({userId: {$ne: null}})  ->  MATCHED real-user-1   (INJECTION BYPASSED FILTER)
```
Repro helper: `backend/cart-service/tests/helpers/probe-nosql.ts` (run with `npx ts-node tests/helpers/probe-nosql.ts` against `platoo_cart_scan`).

**Impact:** Cross-user cart access/modification without authentication, plus a reliable 500 error path. (Note: mongoose 8 defaults `strictQuery` on, and blocks `$where`, which limits the payload space — but `$ne`/`$gt` object operators still bypass the filter.)

**Proposed fix (NOT applied):**
```diff
--- a/backend/cart-service/src/controllers/cartController.ts
+++ b/backend/cart-service/src/controllers/cartController.ts
@@
-export const addItemToCart = async (req: Request, res: Response): Promise<void> => {
-  const { userId, productId, name, price, quantity, image } = req.body;
+export const addItemToCart = async (req: Request, res: Response): Promise<void> => {
+  const userId = (req as any).user.sub;
+  const { productId, name, quantity, image } = req.body;
+  // Reject non-string identity values outright (defence in depth).
+  if (typeof userId !== 'string') { res.status(400).json({ message: 'Invalid userId' }); return; }
```
Also cast/validate with a schema validator (e.g., `zod`) and, if using mongoose, `mongoose.set('sanitizeFilter', true)` or `mongoose.trusted()`.

---

### VULN-06 — Insecure file upload (High)

**Location:** `backend/menu-service/src/routes/upload.routes.ts:23-37` — filter only checks the **filename extension**; no content sniffing; no auth; 2 MB limit per file but no per-user/quota limit.

**Reproduction:** `hiruni docs/security/evidence/EV-M5-menu-upload-html-as-png.txt`
- Upload an HTML/script file renamed `evil.png` with MIME `image/png` → **201 Created**.
- The file is stored and served back under `/uploads/<name>.png` with its original HTML body (`<script>alert(1)</script>`).
- TC-BB-052 confirms HTML payload smuggled with an image extension is accepted.

**Impact:** Arbitrary file hosting, potential stored XSS if a front end ever renders the file as HTML, content-type confusion, and disk-fill DoS.

**Proposed fix (NOT applied):**
```diff
--- a/backend/menu-service/src/routes/upload.routes.ts
+++ b/backend/menu-service/src/routes/upload.routes.ts
@@
-const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
+const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
+const allowedMimes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
 const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
   const ext = path.extname(file.originalname).toLowerCase();
-  if (allowedExts.includes(ext)) {
+  if (allowedExts.includes(ext) && allowedMimes.includes(file.mimetype)) {
     cb(null, true);
   } else {
     cb(new Error('Only image files are allowed (png, jpg, jpeg, gif, webp)'));
   }
 };
```
Also (a) sniff magic bytes (e.g., `file-type`) before persisting, (b) store uploads outside the web root or serve with `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`, and (c) require authentication on `/api/upload`.

---

### VULN-07 — Verbose errors / internal error leakage (Medium)

**Locations:**
- `menu-service/src/app.ts:18-22` — error handler returns `err.message` with status **400** for every error.
- `menu-service` controllers — `res.status(500).json({ error: error.message })` everywhere (e.g., `restaurant.controller.ts:37`).
- `cart-service/src/controllers/cartController.ts:29,55,75,108` — the **entire error object** is returned.
- `cart-service/src/app.ts` — **no error handler**, so Express's default dev error page with a **full stack trace** is returned.

**Reproduction:** `EV-M3-menu-verbose-errors.txt`, `EV-C4-cart-verbose-errors.txt`, `EV-C6-cart-stacktrace.txt`
- `GET /api/restaurants/not-an-objectid` → `{"error":"Cast to ObjectId failed for value ... for model \"Restaurant\""}`.
- Cart validation error → full mongoose `ValidationError` with internal paths/values.
- Malformed cart JSON → HTML page containing the full stack trace with **absolute file paths** and dependency internals.

**Impact:** Leaks internal structure, model names, dependency versions/paths, and helps attackers craft further attacks. Also produces incorrect status codes (500 where 4xx is correct).

**Proposed fix (NOT applied):**
```diff
--- a/backend/menu-service/src/app.ts
+++ b/backend/menu-service/src/app.ts
@@
 app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
-  res.status(400).json({ error: err.message || 'Upload failed' });
+  const isValidation = err.name === 'ValidationError' || err.name === 'CastError';
+  res.status(isValidation ? 400 : 500).json({
+    error: process.env.NODE_ENV === 'production' ? 'Request failed' : err.message,
+  });
 });
```
```diff
--- a/backend/cart-service/src/controllers/cartController.ts
+++ b/backend/cart-service/src/controllers/cartController.ts
@@
-    res.status(500).json({ message: 'Error adding item to cart', error });
+    res.status(500).json({ message: 'Error adding item to cart' });
```
Add a central error-handling middleware to `cart-service` and run production with `NODE_ENV=production`.

---

### VULN-08 — Missing security headers + permissive CORS (Medium)

**Location:** both `app.ts` — only `cors()` (defaults to `Access-Control-Allow-Origin: *`); no `helmet`, no CSP, no `X-Content-Type-Options`, no `Permissions-Policy`.

**Reproduction:** `EV-M4-menu-headers-cors.txt`, ZAP reports `ZAP-menu-service.json` / `ZAP-cart-service.json` (warnings 10037 X-Powered-By, 10055 CSP, 10063 Permissions-Policy, 10098 Cross-Domain Misconfiguration).

**Impact:** Any origin can make cross-origin requests; missing headers remove browser-side defence in depth.

**Proposed fix (NOT applied):**
```diff
--- a/backend/menu-service/src/app.ts
+++ b/backend/menu-service/src/app.ts
@@
 import uploadRoutes from './routes/upload.routes';
+import helmet from 'helmet';
 const cors = require("cors");
 const app = express();
 
-app.use(cors());
+app.use(helmet());
+app.disable('x-powered-by');
+app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? false }));
```
(and the same in `cart-service/src/app.ts`).

---

### VULN-09 — No rate limiting (Medium)

**Location:** both services — no `express-rate-limit` (or equivalent) anywhere.

**Impact:** Unlimited brute-force/credential-stuffing and trivial resource-exhaustion (DoS), compounded by the lack of auth (VULN-01/02) and the 2 MB upload path (VULN-06).

**Proposed fix (NOT applied):**
```diff
--- a/backend/menu-service/src/app.ts
+++ b/backend/menu-service/src/app.ts
@@
 import helmet from 'helmet';
+import rateLimit from 'express-rate-limit';
 const cors = require("cors");
 const app = express();
 
 app.use(helmet());
+app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true }));
```

---

### VULN-10 — Host header injection into returned upload URL (Medium)

**Location:** `upload.routes.ts:39` — `` `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` ``.

**Reproduction:** `EV-M5-menu-upload-html-as-png.txt` step 3
- `POST /api/upload -H 'Host: evil.example:9999'` → response `{"url":"http://evil.example:9999/uploads/....png"}`.
- TC-BB-054 confirms Host reflection.

**Impact:** If the returned URL is persisted and later used in emails/links, it enables cache poisoning / phishing / SSRF pivots.

**Proposed fix (NOT applied):**
```diff
--- a/backend/menu-service/src/routes/upload.routes.ts
+++ b/backend/menu-service/src/routes/upload.routes.ts
@@
-  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
+  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
+  const url = `${base}/uploads/${req.file.filename}`;
```

---

### VULN-11 — Double-response / unhandled `ERR_HTTP_HEADERS_SENT` (Medium)

**Location:** `category.controller.ts:45-49` and `:65-69`; `menuItem.controller.ts` delete handler. When the resource is missing, the handler sends `404` **and then also sends `200`** (no `return`), producing an `ERR_HTTP_HEADERS_SENT` unhandled error.

**Reproduction:** TC-BB-031 (update non-existent category), TC-BB-032 (delete non-existent category → returns 200), TC-BB-046 (delete non-existent menu item → returns 200). Server logs show `ERR_HTTP_HEADERS_SENT`.

**Impact:** Incorrect API semantics (success reported for a no-op), unhandled exceptions, potential process-level error noise.

**Proposed fix (NOT applied):**
```diff
--- a/backend/menu-service/src/controllers/category.controller.ts
+++ b/backend/menu-service/src/controllers/category.controller.ts
@@
     if (!updatedCategory) {
-       res.status(404).json({ error: 'Category not found' });
+       res.status(404).json({ error: 'Category not found' });
+       return;
     }
 
     res.status(200).json(updatedCategory);
@@
     if (!deletedCategory) {
-       res.status(404).json({ error: 'Category not found' });
+       res.status(404).json({ error: 'Category not found' });
+       return;
     }
 
     res.status(200).json({ message: 'Category deleted successfully' });
```

---

### VULN-12 — Vulnerable & outdated dependencies (High)

**Reproduction:** `hiruni docs/security/evidence/AUDIT-menu-service.json`, `AUDIT-cart-service.json`.

| Service | Low | Moderate | High | Critical | Total |
|---------|-----|----------|------|----------|-------|
| menu-service | 1 | 2 | 6 | 0 | 9 |
| cart-service | 1 | 3 | 7 | 0 | 11 |

Direct dependencies flagged:
- **menu-service:** `express`, `mongoose` (e.g., *Mongoose improper sanitization of `$nor` may allow NoSQL injection*; *prototype pollution in update casting*).
- **cart-service:** `express`, `body-parser`, `mongoose`, and `axios` (a very large set of prototype-pollution / SSRF / ReDoS advisories).

Transitive: `brace-expansion`, `minimatch`, `path-to-regexp`, `picomatch`, `qs`, `follow-redirects`, `diff`.

**Impact:** Known-exploitable DoS, ReDoS, prototype pollution, and NoSQL-injection primitives already reachable through the public API.

**Proposed fix (NOT applied):** run `npm audit fix` for non-breaking upgrades, then review and apply major upgrades (`express@5`, latest `mongoose`, `axios`) in a controlled change with regression tests.

---

### VULN-13 — Container build leaks `.env` / runs dev mode (Medium)

**Location:** `backend/menu-service/Dockerfile`, `backend/cart-service/Dockerfile`.
- No `.dockerignore` in either service.
- `COPY . .` copies the local `.env` (confirmed present on disk) and `uploads/` into the image.
- `ENV NODE_ENV=development` and `CMD ["npm","run","dev"]` (nodemon) in the image.

**Impact:** Secrets baked into image layers (readable by anyone with image access), verbose error pages enabled, dev tooling in production.

**Proposed fix (NOT applied):**
```diff
--- /dev/null
+++ b/backend/menu-service/.dockerignore
+node_modules
+.env
+.env.*
+!.env.example
+uploads
+coverage
+tests
+.git
+npm-debug.log
```
```diff
--- a/backend/menu-service/Dockerfile
+++ b/backend/menu-service/Dockerfile
@@
-# Set environment to development
-ENV NODE_ENV=development
+# Set environment to production
+ENV NODE_ENV=production
@@
-# Run the app in development mode using nodemon
-CMD ["npm", "run", "dev"]
+# Run the compiled app
+CMD ["npm", "start"]
```
Apply the same to `cart-service`.

---

### VULN-14 — Stored XSS payloads persisted verbatim *(suspected)* (Medium)

**Reproduction:** TC-BB-006 (restaurant name), TC-BB-037 (menu item name/description) store HTML/script payloads verbatim; `SEC-*` white-box observations confirm no sanitisation in the models/services.

**Status: suspected.** Exploitation depends on a front-end sink that renders these fields as HTML without escaping. No front-end was in scope, so this is reported as a **latent** issue.

**Proposed fix (NOT applied):** validate/sanitise on input (e.g., `validator`/`DOMPurify` for free text), encode on output in every client, and set a strict CSP (see VULN-08).

---

### VULN-15 — Committed secrets in k8s manifests (Critical, **out of scope**)

**Reproduction:** `hiruni docs/security/evidence/SCAN-gitleaks.json` (21 findings across 12 commits).
Gitleaks flagged `kind: Secret` manifests and, in particular:
- `backend/k8s/stripe-payment-service.yaml:8` — a live-looking Stripe **secret key** (`sk_test_...`).
- `backend/k8s/admin-service.yaml:10` — base64 email password.
- `backend/k8s/user-service.yaml:9` — base64 `jwt-secret`.

These files are **outside the two in-scope services**, so they are reported for awareness only and were not remediated. They are still serious: secrets in git history should be **rotated** and replaced with an external secret manager (Sealed Secrets / External Secrets / Vault). Do not treat this report as a substitute for a repository-wide secrets cleanup.

---

## 9. Static Analysis, Dependency & Secret Scan Results

| Scanner | Scope | Result |
|---------|-------|--------|
| Semgrep (`p/javascript`, `p/nodejs`, `p/owasp-top-ten`) | `menu-service/src`, `cart-service/src` | 0 findings, 0 errors (79 rules) |
| npm audit | both services | 9 + 11 advisories (see VULN-12) |
| Gitleaks | full git history | 21 leaks (k8s manifests — VULN-15) |
| OWASP ZAP baseline | `localhost:3101`, `localhost:3105` | 0 FAIL, 5 WARN each (headers/CORS — VULN-08) |

**Interpretation:** the community Semgrep rulesets produced no findings because the issues here are **authorization/business-logic** flaws (missing auth, IDOR, mass assignment, price tampering) that pattern-based rules generally do not detect. This is a key lesson: passing a static scanner does not mean the service is secure — the manual/functional and dynamic testing is what surfaced the critical issues.

---

## 10. False Positives & Non-Findings (verified NOT vulnerable)

These were tested and behaved securely, so they are explicitly recorded to avoid re-flagging:

| Observation | Verdict |
|-------------|---------|
| Path traversal via upload filename (`../../x.png`) | **Not vulnerable** — server generates random filenames; client name discarded (TC-BB-053). |
| Disallowed extension (`.html`) upload | **Rejected** by the extension filter (TC-BB-049). |
| No file supplied to upload | **400** handled correctly (TC-BB-050). |
| Oversized upload (>2 MB) | **Rejected** by multer `limits.fileSize` (TC-BB-051). |
| `.env` files committed to git | **Not present** — only `.env.example` is tracked (`git ls-files` clean for `.env`). |
| Valid-but-unknown ObjectId lookups | Correctly return **404** (TC-BB-011/014/019). |
| Garbage/expired JWT on a *read* path | Returns data because there is **no auth at all** (a finding, not a false positive) — noted for clarity. |

---

## 11. Unconfirmed / Suspected Risks

| Risk | Why unconfirmed | Suggested verification |
|------|-----------------|------------------------|
| Stored XSS (VULN-14) | No front-end/rendering sink in scope | Trace each field to its UI sink; test with a browser/DOM sanitiser. |
| Cross-service trust | `cart-service` does not verify prices against `menu-service` | Inspect order/payment service consumption of cart data. |
| `$where`/deep NoSQL payloads | mongoose 8 blocks `$where`; other operators untested | Fuzz with a broader operator wordlist. |
| Prototype pollution via `req.body` | npm audit flags mongoose/axios gadgets; not exploited end-to-end | Attempt `__proto__`/`constructor` payloads against update endpoints. |
| Redis/other infra auth | Not in scope | Review deployment manifests. |

---

## 12. Secure Development Practices (recommendations)

1. **Authenticate every request** at the edge/gateway and re-check authorization per resource (deny by default).
2. **Never trust the client** for identity, price, quantity, ownership or flags — derive them server-side.
3. **Validate & allow-list** request bodies with a schema library (`zod`/`joi`/`express-validator`); strip unknown keys.
4. **Parameterise/guard database queries**; enable `sanitizeFilter`, reject object-typed inputs where strings are expected.
5. **Return generic errors** and correct status codes; centralise error handling; run production with `NODE_ENV=production`.
6. **Harden responses**: `helmet`, strict CORS allow-list, CSP, `X-Content-Type-Options: nosniff`, disable `X-Powered-By`.
7. **Validate uploads by content**, not extension; store outside web root; require auth; enforce quotas.
8. **Rate-limit and size-limit** all endpoints.
9. **Keep dependencies patched**; run `npm audit`/SCA in CI and fail on high/critical.
10. **Never commit secrets**; use a secret manager, add `.dockerignore`, and scan with Gitleaks in CI.
11. **Add security regression tests** (the suites in this assessment can be promoted to CI gates once fixes land).

---

## 13. Re-running This Assessment

### 13.1 Prerequisites
- MongoDB + Redis running (Docker).
- `npm install` already done in both services (devDeps added by this assessment).
- For scanners: Docker Desktop running.

### 13.2 Functional tests

```powershell
# menu-service
cd backend\menu-service
npm run test:whitebox      # 58 pass
npm run test:blackbox      # 47 pass / 7 fail (expected defect evidence)
npm run test:coverage      # full run + coverage table

# cart-service
cd backend\cart-service
npm run test:whitebox      # 21 pass
npm run test:blackbox      # 17 pass / 6 fail (expected defect evidence)
npm run test:coverage
```

> Black-box failures are **expected** and represent live defects. If a failure disappears after a fix, the corresponding vulnerability has been remediated.

### 13.3 Dynamic evidence

```powershell
# 1. Start the two throwaway instances (separate terminals, from each service dir):
$env:PORT=3101; $env:MONGODB_URI="mongodb://127.0.0.1:27017/platoo_menu_scan"; npx ts-node src/server.ts
$env:PORT=3105; $env:MONGODB_URI="mongodb://127.0.0.1:27017/platoo_cart_scan"; npx ts-node src/server.ts

# 2. From the repo root:
powershell -ExecutionPolicy Bypass -File "hiruni docs\security\scripts\evidence-dynamic-menu.ps1"
powershell -ExecutionPolicy Bypass -File "hiruni docs\security\scripts\evidence-dynamic-cart.ps1"
```
Outputs are written to `hiruni docs/security/evidence/EV-*.txt`.

### 13.4 Scanners

```powershell
# npm audit
cd backend\menu-service; npm audit --json > "..\..\hiruni docs\security\evidence\AUDIT-menu-service.json"
cd ..\cart-service;      npm audit --json > "..\..\hiruni docs\security\evidence\AUDIT-cart-service.json"

# gitleaks (git history)
docker run --rm -v "${PWD}:/repo" zricethezav/gitleaks:latest detect --source=/repo `
  --report-format=json --report-path="/repo/hiruni docs/security/evidence/SCAN-gitleaks.json" --exit-code 0

# semgrep
docker run --rm -v "${PWD}\backend\menu-service:/src" returntocorp/semgrep:latest `
  semgrep scan --config=p/javascript --config=p/nodejs --config=p/owasp-top-ten --json --output=/src/semgrep-menu.json /src/src

# ZAP baseline (needs the scan instances running)
docker run --rm --add-host=host.docker.internal:host-gateway `
  -v "${PWD}\hiruni docs\security\evidence:/zap/wrk/:rw" ghcr.io/zaproxy/zaproxy:stable `
  zap-baseline.py -t http://host.docker.internal:3101 -J ZAP-menu-service.json -r ZAP-menu-service.html -m 3
```

### 13.5 Cleanup (after testing)

```powershell
# Drop the disposable scan databases (never touches dev data)
node -e "const m=require('mongoose');m.connect('mongodb://127.0.0.1:27017/platoo_menu_scan').then(async()=>{await m.connection.dropDatabase();await m.disconnect();})"
node -e "const m=require('mongoose');m.connect('mongodb://127.0.0.1:27017/platoo_cart_scan').then(async()=>{await m.connection.dropDatabase();await m.disconnect();})"
```
Stop the two `ts-node` processes when done.

---

## 14. Evidence Index

All under `hiruni docs/security/evidence/`:

| File | Contents |
|------|----------|
| `EV-M1-menu-noauth-crud.txt` | menu CRUD with no/garbage JWT |
| `EV-M2-menu-mass-assignment.txt` | `owner_id`/`is_active` overwrite via PUT |
| `EV-M3-menu-verbose-errors.txt` | CastError + validation leak |
| `EV-M4-menu-headers-cors.txt` | missing headers / permissive CORS |
| `EV-M5-menu-upload-html-as-png.txt` | HTML-as-PNG upload + Host header reflection |
| `EV-C1-cart-idor.txt` | cross-user cart read/write/delete, no auth |
| `EV-C2-cart-price-tamper.txt` | price 1 / -500 stored; qty 0 error |
| `EV-C3-cart-nosql-injection.txt` | `$ne` bypass matching another user's cart |
| `EV-C4-cart-verbose-errors.txt` | mongoose error object returned |
| `EV-C5-cart-jwt-not-verified.txt` | garbage/alg-none token accepted |
| `EV-C6-cart-stacktrace.txt` | Express default error page with stack trace |
| `AUDIT-menu-service.json` / `AUDIT-cart-service.json` | npm audit JSON |
| `SCAN-gitleaks.json` | committed-secret findings |
| `SCAN-semgrep-menu-service.json` / `SCAN-semgrep-cart-service.json` | semgrep JSON |
| `ZAP-menu-service.json/.html` / `ZAP-cart-service.json/.html` | ZAP baseline reports |
| `TEST-whitebox-*.txt`, `TEST-blackbox-*.txt`, `TEST-coverage-*.txt` | Jest run logs |

Reusable scripts live in `hiruni docs/security/scripts/`.

---

## 15. Summary

- **156 tests written** (143 pass, 13 fail = intentional defect evidence); coverage: menu **90.42% stmts / 88.53% lines**, cart **98.07% stmts / 97.82% lines**.
- **15 vulnerabilities documented** (13 in-scope, 1 suspected, 1 out-of-scope repository secret). Highest severity: missing authentication (VULN-01/02), mass assignment (VULN-03), price tampering (VULN-04), NoSQL injection (VULN-05).
- **No application code was changed and no fixes were applied.** Proposed fixes are shown as diffs for review only.
