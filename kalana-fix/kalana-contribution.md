# Kalana Contribution — Security Fixes for `delevery-service` & `admin-service`

**Date:** 2026-09-23
**Author:** Kalana
**Scope:** `backend/delevery-service`, `backend/admin-service`
**Status:** All findings below are **fixed and verified** (`tsc --noEmit` passes; `npm audit` reports 0 vulnerabilities in both services). Changes are **not yet committed**.

| ID | Severity | OWASP 2021 | Service | Title |
|----|----------|------------|---------|-------|
| K-05 | High | A01:2021 Broken Access Control | delevery | No authentication on any delivery route |
| K-06 | High | A01:2021 Broken Access Control | delevery | IDOR: arbitrary `driverId` accepted from URL params |
| K-07 | Medium | A04:2021 Insecure Design | delevery | Mass assignment in `createDelivery` |
| K-08 | Medium | A05:2021 Security Misconfiguration | delevery | Raw error objects leaked to clients |
| Deps | — | — | delevery | 9 npm vulnerabilities (6 high, 2 moderate, 1 low) |
| K-01 | High | A01:2021 Broken Access Control | admin | Unauthenticated admin email/invite endpoint |
| K-03 | Medium | A05:2021 Security Misconfiguration | admin | Wide-open CORS |
| K-04 | Medium | A04:2021 Insecure Design | admin | No input validation / no rate limiting on email sender |
| Deps | — | — | admin | 12 npm vulnerabilities (7 high, 1 critical) |

---

## 1. delevery-service

### 1.1 K-05 — No authentication on any delivery route — HIGH

**Finding.** The service mounted `/api/delivery` with only `cors` and `express.json()` before it; none of the routes required a token. Every route was anonymous:

- `POST /` — create deliveries
- `GET /` — list **all** deliveries including `customerName`, `deliveryAddress`, `restaurantName`, `earnings`
- `GET /unassigned`, `GET /assigned/:driverId`, `GET /driver/:driverId`, `GET /driver/:driverId/completed`
- `DELETE /:id` — delete **any** delivery record

Blast radius: full read of customer PII (names/addresses/earnings) plus destructive `DELETE` on production data, with no notion of who the caller was.

**Evidence (before):**
```ts
// src/routes/deliveryRoutes.ts
router.post("/", DeliveryController.createDelivery);
router.get("/", DeliveryController.getAllDeliveries);
router.delete("/:id", DeliveryController.deleteDelivery);
// ... no middleware anywhere
```

**Fix applied.**
1. Added `jsonwebtoken` + `@types/jsonwebtoken` as dependencies.
2. New `src/middleware/auth.ts` — verifies the user-service HS256 `JWT_SECRET` Bearer token and attaches `req.user = { id, role }`; exports `AuthRequest` (used by K-06):

```ts
export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) { res.status(401).json({ message: "Unauthorized: No token provided" }); return; }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};
```

3. Applied `authMiddleware` to every route (`POST /`, `GET /`, `GET /unassigned`, `GET /assigned/:driverId`, `GET /driver/:driverId`, `GET /driver/:driverId/completed`, `DELETE /:id`).
4. Added `JWT_SECRET` (matching user-service) to `delevery-service/.env`.

### 1.2 K-06 — IDOR: arbitrary `driverId` from URL params — HIGH

**Finding.** `driverId` was taken verbatim from `req.params` and used as a filter on `assignedTo`. With no auth (K-05), any caller could enumerate `driverId` values and read another driver's every delivery, their **earnings** (`/driver/:driverId/completed` — `deliveryStatus: "delivered"`), and the customer name/address on their active delivery (`/assigned/:driverId`).

**Evidence (before):**
```ts
const { driverId } = req.params;
const deliveries = await DeliveryService.getDeliveriesByDriver(driverId);
```

**Fix applied.**
1. Added two authorization helpers to `src/middleware/auth.ts`:
   - `requireRoles(...roles)` — 403 unless the verified caller's role is in the list.
   - `requireDriverMatch` — admin passes (may query any driver); a `delivery_man` gets **403** unless the URL `driverId` equals the token subject; any other role gets 403.
2. Routes now enforce a role matrix:

| Route | Allowed callers |
|-------|-----------------|
| `POST /` | `admin`, `restaurant_owner` |
| `GET /` | `admin` only |
| `GET /unassigned` | `delivery_man`, `admin` |
| `GET /assigned/:driverId` | `delivery_man` (own) / `admin` |
| `GET /driver/:driverId` | `delivery_man` (own) / `admin` |
| `GET /driver/:driverId/completed` | `delivery_man` (own) / `admin` |
| `DELETE /:id` | `admin` only |

3. Controllers now derive the driver identity from the **verified token subject** (`resolveDriverId`) instead of trusting the URL for `delivery_man`:

```ts
private static resolveDriverId(req: AuthRequest): string {
  if (req.user && req.user.role === "delivery_man") return req.user.id;
  return req.params.driverId; // admin only past requireDriverMatch
}
```

**Residual (documented):** the Delivery schema has no customer-account/`userId` field, so "customer reads only their own orders" still requires a `orderId`→order-service user linkage. All list reads therefore default to `admin`. This is tracked alongside K-07.

### 1.3 K-07 — Mass assignment in `createDelivery` — MEDIUM

**Finding.** `createDelivery` wrote every field of `req.body` straight into a Mongoose document. An anonymous caller could create deliveries pre-`assigned` to a chosen driver, already `delivered`, or carrying arbitrary `earnings` — tampering with the driver-earnings ledger and poisoning the "unassigned" work queue.

**Evidence (before):**
```ts
static async createDelivery(deliveryData: IDelivery): Promise<IDelivery> {
  const delivery = new Delivery(deliveryData);
  return await delivery.save();
}
```

**Fix applied.** `createDelivery` now whitelists only the caller-supplied fields and forces safe defaults on everything the server owns (`deliveryStatus: "pending"`, `assignedTo: null`, `earnings: 0`, `deliveredAt: null`). Any field the client sends beyond the whitelist is silently dropped; the six required fields must be present or a clean 400 is returned:

```ts
static async createDelivery(deliveryData: IDelivery): Promise<IDelivery> {
  const { orderId, customerName, deliveryAddress, restaurantName, pickupTime, deliveryTime } = deliveryData;
  if (!orderId || !customerName || !deliveryAddress || !restaurantName || !pickupTime || !deliveryTime) {
    throw new Error("orderId, customerName, deliveryAddress, restaurantName, pickupTime and deliveryTime are required");
  }
  const delivery = new Delivery({
    orderId, customerName, deliveryAddress, restaurantName, pickupTime, deliveryTime,
    deliveryStatus: "pending", assignedTo: null, earnings: 0, deliveredAt: null,
  });
  return await delivery.save();
}
```

Status/assignment can now only change through the dedicated transition methods `assignDeliveryToMan` / `updateDeliveryStatus`, which remain unexposed on routes (intended server-side workflow steps).

### 1.4 K-08 — Raw error objects leaked to clients — MEDIUM

**Finding.** Every `catch` in `src/controllers/deliveryController.ts` returned `{ message: ..., error }`, sending Mongoose `CastError` stack traces, validation internals and DB connection metadata to the client.

**Evidence (before):**
```ts
} catch (error) {
  res.status(400).json({ message: "Failed to create delivery", error });
}
```

**Fix applied.** All 7 catch blocks now log the exception server-side and return a generic message only — no `error` object reaches the client:

```ts
} catch (error) {
  console.error("createDelivery failed:", error);
  res.status(400).json({ message: "Failed to create delivery" });
}
```

### 1.5 Deps (delevery-service) — 9 vulnerabilities

**Finding (before).** `npm audit`: **9 vulnerabilities (6 high, 2 moderate, 1 low)** — express 4.21.2 chain (body-parser 1.20.3, path-to-regexp 0.1.12, qs 6.13.0), mongoose 8.13.1 (GHSA-wpg9-53fq-2r8h, GHSA-664h-wqgq-64gw), and dev-toolchain transitives (minimatch 3.1.2, brace-expansion 1.1.11, picomatch 2.3.1, diff 4.0.2).

**Fix applied.** Ran `npm audit fix` and bumped manifest minimums to `express ^4.22.3` and `mongoose ^8.24.4`. Effective installed versions:

| Package | Before | After |
|---------|--------|-------|
| express | 4.21.2 | **4.22.3** |
| body-parser | 1.20.3 | **1.20.8** |
| path-to-regexp | 0.1.12 | **0.1.13** |
| qs | 6.13.0 | **6.16.0** |
| mongoose | 8.13.1 | **8.24.4** |
| minimatch | 3.1.2 | **3.1.5** |
| brace-expansion | 1.1.11 | **1.1.21** |
| picomatch | 2.3.1 | **2.3.2** |
| diff | 4.0.2 | **4.0.4** |

All upgrades stay within the original major/minor families (express stays 4.x — route handling semantics unchanged). **Result: `npm audit` → 0 vulnerabilities.**

---

## 2. admin-service

### 2.1 K-01 — Unauthenticated admin email/invite endpoint — HIGH

**Finding.** `POST /api/email/send-admin-invite` had **no authentication** — the only route in the service. Any anonymous caller could (a) abuse the service's own Gmail SMTP account for high-volume mail (spam relay / quota exhaustion), and (b) send forged "Your admin account has been created — Password: X" phishing emails to arbitrary addresses with attacker-chosen passwords. Same bug class as order-service V-04.

**Evidence (before):**
```ts
router.post('/send-admin-invite', async (req, res) => {
  const { email, name, password } = req.body;
  const transporter = nodemailer.createTransport({ ... });
  await transporter.sendMail(mailOptions);
});
```
No token parsing existed anywhere in `src/`.

**Fix applied.**
1. Added `jsonwebtoken` + `@types/jsonwebtoken` as direct dependencies.
2. New `src/middleware/auth.ts` exports `requireAdmin` — verifies the user-service HS256 `JWT_SECRET` Bearer token, requires `role === "admin"` (otherwise 403), attaches `req.user`, and returns 401 on missing/invalid tokens (with server-side `console.error` on verify failure).
3. Wired onto the route: `router.post('/send-admin-invite', requireAdmin, ...)`.
4. Added `JWT_SECRET` (matching user-service) to `admin-service/.env`.

Response codes: **401** no token / invalid token, **403** valid token with a non-`admin` role.

### 2.2 K-03 — Wide-open CORS — MEDIUM

**Finding.** `app.use(cors())` reflected/accepted every origin (`Access-Control-Allow-Origin: *`). Combined with the (then unauthenticated) invite endpoint, any webpage a victim visited could issue invite requests from the victim's browser (pre-flighted and allowed) and abuse the SMTP channel.

**Evidence (before):**
```ts
const cors = require('cors');
...
app.use(cors()); // no origin option
```

**Fix applied.** Replaced with an explicit allowlist of the admin-dashboard origins (the Next.js client on port 3000 — same pattern delevery-service already uses):

```ts
const corsOptions = {
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
```

Any other origin now receives **no `Access-Control-Allow-Origin`** header, so cross-origin abuse of the invite endpoint is blocked at the browser layer. Live-verified (see §3).

### 2.3 K-04 — No input validation / no rate limiting — MEDIUM

**Finding.** `email`, `name`, `password` were accepted with zero validation; there was no throttling and no queue. The SMTP relay was fully automatable — arbitrary invite volume exhausting the Gmail sending quota — and unreviewed fields could drive email-header/address-parsing edge cases.

**Fix applied.** The route now runs `requireAdmin → rateLimitInvites → validateAdminInvite` before handling.

1. **`src/middleware/validate.ts`** — schema checks:
   - `email`: must match `^[^\s@]+@[^\s@]+\.[^\s@]+$`, max 254 chars
   - `name`: trimmed length 1–100 chars
   - `password`: length 8–128 chars
   - Failures return `400 { error: "Validation failed", details: [...] }`.

2. **`src/middleware/inviteRateLimit.ts`** — in-memory sliding windows:
   - **Per-IP:** 10 requests / 15 minutes → `429`.
   - **Per-recipient:** 3 invites / hour per recipient address → `429`.

3. **`src/services/mailQueue.ts`** — outgoing-mail queue:
   - Serializes sends (single in-process FIFO worker — one `sendMail` at a time).
   - Retries up to 3 times with exponential backoff (`500ms * 2^n`), logging each failure server-side.
   - Throws a sanitized `"Email sending failed"` (no SMTP internals); the route's 500 now returns a generic `details`.
   - Type imports updated from the `nodemailer.XXX` namespace to named `Transporter` / `SendMailOptions` for `@types/nodemailer` (relevant for the nodemailer 10 upgrade, §2.4).

No new runtime dependencies were added; the email body is unchanged (emailing plaintext passwords is tracked separately in K-02).

### 2.4 Deps (admin-service) — 12 vulnerabilities

**Finding (before).** `npm audit`: **12 vulnerabilities (7 high, 3 moderate, 1 critical)** — nodemailer 6.x (GHSA-mm7p-fcc7-pg87 and the whole SMTP-injection/SSRF family, needs breaking 10.x), mongoose 8.14.0 (`$nor` NoSQL injection + prototype pollution), twilio-chain axios 1.9.0 (large advisory family incl. SSRF/prototype-pollution/DoS), form-data 4.0.2 (**critical** unsafe boundary random), path-to-regexp 8.2.0, body-parser 2.2.0, qs 6.14.0, minimatch 3.1.2, brace-expansion 1.1.11, picomatch 2.3.1, diff 4.0.2, follow-redirects 1.15.9.

**Fix applied.** `npm audit fix` for the transitive chain + explicit upgrades with bumped manifest minimums:

| Package | Before | After |
|---------|--------|-------|
| nodemailer | 6.10.1 | **10.0.10** (breaking change per audit; API used — `createTransport`/`sendMail` — unchanged) |
| mongoose | 8.14.0 | **8.24.4** |
| axios | 1.9.0 | **1.20.0** |
| form-data | 4.0.2 | **4.0.6** (critical advisory cleared) |
| follow-redirects | 1.15.9 | **1.16.0** |
| path-to-regexp | 8.2.0 | **8.4.2** |
| body-parser | 2.2.0 | **2.3.0** |
| qs | 6.14.0 | **6.16.0** |
| minimatch | 3.1.2 | **3.1.5** |
| brace-expansion | 1.1.11 | **1.1.21** |
| picomatch | 2.3.1 | **2.3.2** |
| diff | 4.0.2 | **4.0.4** |

**Result: `npm audit` → 0 vulnerabilities.**

---

## 3. Verification

- **Type checking:** `tsc --noEmit` passes in both `backend/delevery-service` and `backend/admin-service`.
- **`npm audit`:** 0 vulnerabilities in both services (delevery was 9, admin was 12).
- **Live smoke test (admin-service booted on port 4099):**
  - `POST /api/email/send-admin-invite` with **no token** → `401 {"message":"Unauthorized: No token provided"}`.
  - Request with **`Origin: http://evil.com`** → response has **no** `Access-Control-Allow-Origin` header (preflight OPTIONS and actual POST both verified).
  - Request with **`Origin: http://localhost:3000`** → `Access-Control-Allow-Origin: http://localhost:3000` present.
  - Request with a garbage `Authorization` → `401 {"message":"Unauthorized: Invalid token"}`.

## 4. Still open (outside this contribution's scope)

| ID | Service(s) | Description |
|----|------------|-------------|
| K-02 | all three | Secrets still plaintext in git-ignored `.env`; rotate Gmail app-password + MongoDB credentials; least-privilege DB users; stop emailing plaintext passwords (passwordless invite links). |
| K-06 residual | delevery | Customer "own-orders-only" reads need a `userId`/order linkage (Delivery schema has no customer field). |
| — | all three | Dynamic (Postman) authorization re-testing against a sandbox DB is still recommended. |