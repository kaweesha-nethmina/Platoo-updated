# Desima — Individual Contribution Report
## Security Hardening of the Search & Notification Services (Platoo Food Ordering System)

**Student:** `<Name>` &nbsp;|&nbsp; **Index No:** `<NIC/Index>` &nbsp;|&nbsp; **Course:** System & Software Design (SSD) — Security Vulnerability Assessment & Fixing

**Contribution scope (my services):**
- `backend/search-service` — restaurant / menu search API (port 3002)
- `backend/notification-service` — delivery-notification e-mail API (port 4006)
- related frontend: the restaurant-orders page that calls the notification API

Original (Pre-fix) application source: commit **`f1ff1c8`** *(2026-09-16 "old project codes")* — this commit predates the semester's assessment window. All fixes and tests were introduced in the `security/search-notification-hardening` work (2026-09-21).

---

## 1. Assignment requirements & how this report maps to them

| Assignment requirement | Where it is addressed |
|---|---|
| Identify ≥ 7 *distinct* vulnerabilities | Section 3 — **16 findings** (SRCH-01…08, NOTIF-01…07, F-01) |
| Try to fix them | Section 4 — all 16 fixed; Before/After code shown |
| Use open-source **black-box** tools | Section 5 — supertest black-box suites against the live HTTP API |
| Use open-source **white-box** tools | Section 6 — Jest unit suites of the internal security logic |
| Report vulns + how they were fixed | Sections 3 & 4 |
| Identify vulns **not fixed** and why | Section 8 |
| Best practices that would prevent them | Section 9 |

---

## 2. Methodology

I assessed both services end-to-end using a mix of dynamic, static and supply-chain tools (all open-source):

| Technique | Tool | What it checks |
|---|---|---|
| Black-box (dynamic) | **supertest** suites over live HTTP (`tests/blackbox/*.test.ts`) | Behaviour exactly as an external attacker sees it: auth codes, injection payloads, headers, CORS, 429 / 413 semantics |
| White-box (static review) | File-by-file source review + Jest unit suites (`tests/whitebox/*.test.ts`) | Internal sanitisation, JWT verification, e-mail construction, error handler |
| SAST | **Semgrep** (`semgrep/semgrep:1.110.0`) with custom taint rules | `req.* → $regex` taint, `jwt.verify` without algorithm pin, `error.* → res.status(500)` |
| Linting (SAST-lite) | **ESLint** `eslint-plugin-security` + `no-unsanitized` | Dangerous `eval`/`innerHTML`/injection-prone patterns |
| SCA / dependency audit | **`npm audit --audit-level=moderate`** | Known-vulnerable dependencies |
| Secret scanning | **gitleaks** (docker) over the committed history | Credentials / keys committed to the repo |
| Load / abuse | **k6** (`tests/perf/*.js`) + raw HTTP bursts | Throughput collapse, rate-limit behaviour |

**Reproducibility.** Every suite is a one-liner per service:

```bash
# search-service
npm run test:whitebox        # jest + coverage
npm run test:blackbox        # against live :3002 (needs seeded MongoDB + menu-service :3001)
npm run test:security        # eslint + npm audit

# notification-service
npm run test:whitebox        # jest + coverage
npm run test:blackbox        # against live :4006 (SMTP_TRANSPORT=mock)
npm run test:security
```

All evidence files are committed under `docs/security/evidence/`.

---

## 3. Consolidated vulnerability register (16 distinct findings)

### 3.1 `search-service`

| ID | Finding | CWE | CVSS v3.1 | Status |
|---|---|---|---|---|
| SRCH-01 | NoSQL operator injection — an object such as `?query[$ne]=x` flows into Mongo `$regex` (operator objects reach the DB, 500s / altered semantics) | 943 | 5.3 | **Fixed** |
| SRCH-02 | User input placed verbatim into `RegExp` — catastrophic-backtracking **ReDoS** (`(a+)+$`) and `.*` over-matching | 1333 / 400 | 5.3 | **Fixed** |
| SRCH-03 | Unbounded results — no `limit`, a search returns the **entire collection** (resource exhaustion) | 770 | 5.3 | **Fixed** |
| SRCH-04 | No rate limiting on the public, unauthenticated API — 50 quick requests collapsed throughput to ~1.7 req/s | 799 / 770 | 3.1 | **Fixed** |
| SRCH-05 | Stack traces / internal error text (incl. `error.message`, `error.response`) leaked in HTTP responses | 209 / 200 | 6.5 | **Fixed** |
| SRCH-06 | `cors()` default `*` — any website could read search responses (default permissive CORS) | 942 / 346 | 4.3 | **Fixed** |
| SRCH-07 | Missing security headers + `X-Powered-By: Express` fingerprinting | 693 / 200 | 3.1 | **Fixed** |
| SRCH-08 | Live MongoDB URI committed as base64 in the k8s `Secret` | 798 | 9.8 | **Fixed** |

### 3.2 `notification-service` (+ frontend)

| ID | Finding | CWE | CVSS v3.1 | Status |
|---|---|---|---|---|
| NOTIF-01 | JWT verification without a pinned algorithm — `alg:none`, HS/RS confusion; also the endpoint was originally **unauthenticated** | 347 | 3.1 | **Fixed** |
| NOTIF-02 | Unbounded e-mail fan-out to every `delivery_man` (e-mail amplification) + **silent SMTP failures reported as 200** | 770 / 703 | 5.4 | **Fixed** |
| NOTIF-03 | Monolithic per-IP limiter — one client's burst throttled all users incl. the frontend; hard-coded budget | 799 / 770 | 5.3 | **Fixed** |
| NOTIF-04 | Disallowed CORS `Origin` produced a **500** (malformed/volatile error) | 346 / 200 | 4.3 | **Fixed** |
| NOTIF-05 | CRLF / HTML injection into e-mails via `orderDetails.customer.*` (header injection / scripted body) | 80 / 93 | 4.3 | **Fixed** |
| NOTIF-06 | Hard-coded Gmail `service` + committed-style credentials in `mailer.ts` | 547 | 4.3 | **Fixed** |
| NOTIF-07 | Gmail app password + MongoDB URI committed as base64 in the k8s `Secret` | 798 | 9.8 | **Fixed** |
| F-01 | Frontend 4006 call missing `Authorization` header → feature silently broken after auth hardening | 306 | — | **Fixed** |

> The register contains **16 distinct findings across OWASP Top-10 categories A01 (broken access control / missing auth), A02 (crypto failures), A03 (injection), A05 (misconfiguration), A07 (identification & authentication / secrets), A10 (SSRF-adjacent / CORS)** — exceeding the minimum of 7 required by the assignment.

---

## 4. Detailed findings and fixes

### 4.1 SRCH-01 & SRCH-02 — NoSQL injection + ReDoS in restaurant search

**Where:** `src/controllers/search.controller.ts` (original)
**How found:** Black-box suite drove `?query[$ne]=pizza`, `?query[$gt]=a`, `?cuisine[$ne]=x`, `?location[$regex]=^.*` against the live API → the original code passed the *object* into `{ $regex: ... }` (Mongo treats `{$ne:...}` as an operator, crashing or bending the query → 500 with internal details). ReDoS payload `(a+)+$` was placed verbatim into the RegExp. Semgrep taint rule `nosql-unsafe-regex-input` flags the exact pattern.

**Before (original, vulnerable):**
```ts
const { query, location, cuisine } = req.query;
const searchQuery: any = {};
if (query) {
  searchQuery.name = { $regex: query, $options: 'i' };   // object $ne/$gt flows in
}
const restaurants = await RestaurantModel.find(searchQuery); // returns EVERYTHING
```

**Fix (`src/utils/sanitize.ts` — new):**
```ts
export function sanitizeSearchParam(value: unknown): string | null {
  if (typeof value !== 'string') return null;        // rejects {$ne:..} objects/arrays
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return escapeRegex(trimmed.slice(0, MAX_SEARCH_LENGTH)); // regex-escape -> ReDoS-safe
}
```

**After (`search.controller.ts`):**
```ts
const safeQuery    = sanitizeSearchParam(query);
const safeLocation = sanitizeSearchParam(location);
const safeCuisine  = sanitizeSearchParam(cuisine);
const pageInfo     = sanitizePagination({ page, limit });
if (!safeQuery && !safeLocation && !safeCuisine) { res.status(400).json(...); return; }
...
searchQuery.name = { $regex: safeQuery, $options: 'i' };
const restaurants = await RestaurantModel.find(searchQuery)
  .skip((pageInfo.page - 1) * pageInfo.limit)
  .limit(pageInfo.limit)
  .maxTimeMS(2000);             // <- also SRCH-03
```

**Verification:**
- Black-box: `query[$ne]` / `query[$gt]` / `cuisine[$ne]` / `location[$regex]` → 400 JSON (was 500); `(a+)+$` completes < 5 s with no stack trace. ✅
- White-box `sanitizeSearchParam`: objects rejected, `(a+)+$.*[x]` → `\(a\+\)\+\$\.\*\[x\]`, length capped at 100. ✅
- Semgrep `nosql-unsafe-regex-input`: 0 findings post-fix. ✅

---

### 4.2 SRCH-03 — Unbounded result sets

**Where:** `search.controller.ts` — `.find(searchQuery)` with no `limit`.
**How found:** code review + black-box test firing `query=.` with `limit=999999999` (a single request could materialise the whole collection).
**Fix:** `sanitizePagination()` clamps `page ≥ 1`, `limit ∈ [1,100]`; query bounded with `.skip/.limit` and `.maxTimeMS(2000)` (query-level timeout guard).
**Verification:** black-box — `limit=999999999` returns ≤ 100 rows; negative/`abc` page handled without 500. ✅

---

### 4.3 SRCH-04 — No rate limiting

**Where:** `src/app.ts` (original had no throttle on a public API).
**How found:** raw burst (50 rapid GETs) collapsed throughput to ~1.7 req/s; black-box `429` assertion.
**Fix (`app.ts`):**
```ts
app.use(rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  limit:    Number(process.env.RATE_LIMIT_MAX || 20),
  standardHeaders: true, legacyHeaders: true,
  message: { error: 'Too many requests, please slow down' },
}));
```
**Verification:** black-box — `RateLimit-Limit/Remaining` headers present; 30 rapid requests produce a 429. ✅

---

### 4.4 SRCH-05 — Internal error disclosure

**Where:** category-search handler returned `error.error.response?.data || error.message` and the catch block returned `error.message` inside the 500 JSON; Express's default HTML body/stack trace leaked absolute FS paths.
**How found:** black-box oversized-POST (`PayloadTooLargeError` HTML with `node_modules` path) + manual review; Semgrep `res-500-with-internals` taint rule.
**Fix (`app.ts`):** central JSON error handler + bounded body:
```ts
app.use(express.json({ limit: '100kb' }));
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
  console.error('[search-service] unhandled error:', err);          // details -> logs only
  res.status(500).json({ error: 'Internal Server Error' });          // static client message
});
```
Controllers now emit only static strings too. **Verification:** black-box — 413 JSON, malformed JSON → 400 JSON, no `node_modules`/`PayloadTooLargeError`/`at MongooseError` in any body. ✅

---

### 4.5 SRCH-06 — Permissive CORS

**Where:** `app.ts` original: `app.use(cors());` → reflects `Access-Control-Allow-Origin: *`.
**How found:** manual review + black-box `Origin: https://evil.example` assertion.
**Fix:** allow-list driven by `CLIENT_URL`; unknown origins get **no** `Access-Control-Allow-Origin` header, so browsers block the read.
**Verification:** black-box — arbitrary origin is not reflected (`acao !== '*'` and `!== 'https://evil.example'`). ✅

---

### 4.6 SRCH-07 — Missing security headers / fingerprint

**Where:** `app.ts` — no Helmet, Express default `X-Powered-By`.
**How found:** manual review + black-box header assertions.
**Fix:** `app.disable('x-powered-by')` + `app.use(helmet())`.
**Verification:** black-box — CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Referrer-Policy` present; `X-Powered-By` absent. ✅

---

### 4.7 SRCH-08 — Committed MongoDB credential

**Where:** `backend/k8s/search-service.yaml` — real live `MONGO_URI` in base64 (`data.mongo-uri`).
**How found:** **gitleaks** secret scan → `kubernetes-secret-yaml` heuristic hit with a decodable `mongodb+srv://...` URI.
**Fix:** replaced the encoded value with a `stringData` placeholder and documented rotation:
```yaml
stringData:
  mongo-uri: '<replace-with-rotated-mongo-uri>'
```
**Verification:** gitleaks after — **0 findings in scope**; the secret must be injected out-of-band (kubectl/Helm/secret-manager). ✅

---

### 4.8 NOTIF-01 — JWT algorithm confusion + unauthenticated endpoint

**Where:** `src/routes/notificationRoutes.ts` + `src/middleware/auth.ts`. The original route had **no `protect` middleware** — anyone on the internet could trigger e-mails. When auth was added it used `jwt.verify(token, secret)` **without** pinning `algorithms`.
**How found:** white-box review; black-box `alg:none` / forged / expired token assertions; Semgrep rule `jwts-verify-no-algorithm`.

**Fix (`auth.ts`):**
```ts
const decoded = jwt.verify(token, process.env.JWT_SECRET || '', { algorithms: ['HS256'] })
  as jwt.JwtPayload & { id: string; role: string };

if (!decoded || typeof decoded.id !== 'string' || decoded.id.length === 0
    || typeof decoded.role !== 'string' || !ALLOWED_ROLES.includes(decoded.role)) {
  res.status(403).json({ error: 'Forbidden: Insufficient permissions' }); return;
}
```
Route now: `router.post('/send-delivery-notification', protect, sendDeliveryNotification);`
`app.ts` also **fails fast** at startup when `JWT_SECRET` is missing instead of rejecting every request at runtime.

**Verification:** black-box — no token → 401; `role:"user"` → 403; wrong-secret → 401; expired → 401; `alg:none` → 401; valid admin → 200. White-box `protect()` suite: 5/5. ✅

---

### 4.9 NOTIF-02 — Unbounded e-mail fan-out + silent failures

**Where:** `src/services/notificationService.ts` (original mapped every `delivery_man` and returned `{ success: true }` even when all `sendMail` calls failed).
**How found:** code review — no recipient cap, per-email errors only logged, controller always returned 200.
**Fix:** recipient cap + loud failure:
```ts
const MAX_RECIPIENTS = Number(process.env.MAX_NOTIFICATION_RECIPIENTS || 50);
const recipients = deliveryPersons.slice(0, MAX_RECIPIENTS);   // truncate + log
...
if (delivered === 0 && failed > 0) {
  throw new Error('Failed to send any notification emails');    // -> 5xx, never fake 200
}
```
The controller now also returns a static message (`'Failed to send notifications'`), never an internal `error.message`.
**Verification:** white-box cap/unit suites; black-box 200 only on a genuinely delivered (mock-transport) send. ✅

---

### 4.10 NOTIF-03 — Rate limiter granularity

**Where:** `src/middleware/rateLimiter.ts` (original: in-memory per-IP `Map` with a hard-coded 10/min budget shared by *everyone* on localhost).
**How found:** review + the observed cross-tenant throttling; black-box 429 assertion.
**Fix:** `express-rate-limit` keyed by **IP + decoded user id**, env-configurable (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`), IPv4-mapped-IPv6 keys normalised (`/^::ffff:/` stripped) to avoid `ERR_ERL_KEY_GEN_IPV6`.
**Verification:** black-box — 429 JSON with standard headers; unit-level key-gen coverage in the white-box suite. ✅

---

### 4.11 NOTIF-04 — CORS denial → 500

**Where:** `app.ts` — a disallowed `Origin` fell through `cors()` into the generic error path → **500** (and echoed a messy response).
**How found:** black-box `Origin: https://evil.example` POST → 500 observed.
**Fix:**
```ts
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));     // routed below
  },
  ...
}));
app.use((err, _req, res, _next) => {
  if (err instanceof Error && err.message === 'Not allowed by CORS')
    return res.status(403).json({ error: 'Origin not allowed' });   // clean 403 JSON
  ...
});
```
**Verification:** black-box — disallowed origin now returns 403 JSON, never 500, and does **not** reflect the offending origin. ✅

---

### 4.12 NOTIF-05 — CRLF / HTML injection into e-mails

**Where:** `notificationService.ts` (original) embedded `orderDetails.customer.name/address` verbatim into the e-mail template; `mailer.ts` allowed any subject/from.
**How found:** code review + black-box payloads `Alice\r\nBcc: attacker@evil.example\r\nX-Evil: 1` and `<img src=x onerror=alert(1)>`.
**Fix:**
- `validateOrderDetails()` (`src/utils/validation.ts`): `id` 1–64 chars, `total` finite ∈ `[0,1e9]`, `name` ≤ 128, `address` ≤ 256.
- `sanitizeEmailField()`: strips `\r\n` entirely (a lone `\n` becomes a space) so user text can never become SMTP headers.
- `buildEmailMessage()`: **fixed** subject/from; all user content confined to the plain-text body.
**Verification:** white-box `sanitizeEmailField('Alice\r\nBcc:...')` → `'AliceBcc:...'`; black-box CRLF/HTML payloads cannot escape the JSON contract or return markup. ✅

---

### 4.13 NOTIF-06 — Hard-coded Gmail transport + credentials

**Where:** `src/utils/mailer.ts` (original hard-coded `nodemailer.createTransport({ service: 'gmail', auth: {...} })` — a fixed Gmail service, no injection point, impossible to test without a real mailbox).
**How found:** source review.
**Fix (`src/utils/transport.ts` — new factory):**
```ts
export const createTransport = (opts: SmtpOptions = {}): Transporter => {
  if (opts.verbose || process.env.SMTP_TRANSPORT === 'mock')      // sandbox mode
    return nodemailer.createTransport({ jsonTransport: true });    // no network, no account
  const host = opts.host || process.env.SMTP_HOST || 'smtp.ethereal.email';
  const port = Number(opts.port || process.env.SMTP_PORT || 587);
  const auth = opts.auth || (process.env.EMAIL_USER && process.env.EMAIL_PASS
      ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } : undefined);
  return nodemailer.createTransport({ host, port, secure: opts.secure ?? false, auth });
};
```
The mailer now reads **only** env/options (no literals), creates the transport **lazily** so `dotenv.config()` has run, and supports `SMTP_TRANSPORT=mock` (nodemailer JSON transport) for the "e-mail sandbox or mock service" requirement of the assignment.
**Verification:** white-box `createTransport({verbose:true})` returns a JSON transport; no credential literals anywhere in source. ✅

---

### 4.14 NOTIF-07 — Committed Gmail + MongoDB credentials

**Where:** `backend/k8s/notification-service.yaml` — real base64 `mongo-uri`, `email-user`, `email-pass` (a Gmail app password).
**How found:** gitleaks scan → decodable `kubernetes-secret-yaml` / `generic-api-key` hits; manual decode confirmed live credentials.
**Fix:** `data` + base64 replaced by `stringData` placeholders:
```yaml
stringData:
  mongo-uri:  '<replace-with-rotated-mongo-uri>'
  email-user: '<replace-with-mailbox-user>'
  email-pass: '<replace-with-app-password>'
```
**Verification:** gitleaks after — 0 in-scope findings; **real app password must be rotated** (operator action, see §8). ✅

---

### 4.15 F-01 — Frontend missing Authorization header

**Where:** `frontend/platoo-client/app/dashboard/restaurant/orders/page.tsx` — the `POST http://localhost:4006/api/notifications/send-delivery-notification` sent only `Content-Type`, so after NOTIF-01 the restaurant dashboard "send notification" action returned 401 (broken feature + unreachable API).
**How found:** functional pass of the restaurant-orders flow with the black-box auth contract.
**Fix:**
```ts
headers: {
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("jwtToken") || ""}`,
}
```
**Verification:** manual E2E — restaurant owner can now trigger a delivery notification; the 401 path in the black-box suite verifies the server side rejects unauthenticated calls. ✅

---

## 5. Black-box (dynamic) testing

**Approach.** Each suite runs over real HTTP against the live, seeded service exactly as an external attacker or browser client would see it. JWT tokens for the notification suite are minted with `jsonwebtoken` using the service's real `JWT_SECRET`, so the suite exercises the genuine authentication path over the wire.

```bash
# service up + seeded, then:
cd backend/search-service && npm run test:blackbox        # 20/20 after
cd backend/notification-service && npm run test:blackbox  # 17/17 after
```

**Before → after evidence** (same assertions, run against commit `f1ff1c8` vs. sharp):

| Metric | Before | After |
|---|---|---|
| search-service black-box suite | **10 pass / 10 fail** | **20 / 20** |
| notification-service black-box suite | **15 pass / 2 fail** | **17 / 17** |

**Representative black-box checks that failed before and pass now:**

| Check | Before (fail) | After (pass) |
|---|---|---|
| `query[$ne]=pizza` | 500 or altered results | **400 JSON** |
| `query[$gt]`, `cuisine[$ne]`, `location[$regex]=^.*` | 500 | **400 JSON** |
| `(a+)+$` timing | hangs / blow-up risk | **fast** 200/400/404 |
| `limit=999999999` | unbounded response | **≤ 100 rows** |
| `Origin: https://evil.example` | `ACAO: *` reflected | **no ACAO header** |
| headers | no CSP/nosniff; `X-Powered-By` present | **Helmet present**, `X-Powered-By` absent |
| oversized POST body | HTML stack trace (`node_modules` path) | **413 JSON** |
| 30 rapid requests | no throttle | **429 JSON** |
| notification no token | 200 (spam) | **401** |
| `alg:none` / forged / expired token | 200 | **401** |
| `role:"user"` token | 200 | **403** |
| disallowed origin (notif) | **500** | **403 JSON "Origin not allowed"** |
| CRLF / HTML customer payloads | raw injection | sanitised / 400, no contract break |

Additional dynamic tooling: **k6** load scripts (`tests/perf/search-load.js`, `tests/perf/notification-load.js`) reproduce the throughput argument for rate limiting, and raw bursts document the 429 threshold.

---

## 6. White-box (static) testing

**Approach.** File-by-file source review plus Jest unit suites that import the *actual internal modules* (`sanitize.ts`, `auth.ts`, `validation.ts`, `transport.ts`, `mailer.ts`) and assert on their security contract. Empty-object/catch-path branches, `any` typing, absence of limits, and unchecked `req.*` usage were flagged during review first; the unit suites lock the fixes in.

```bash
cd backend/search-service && npm run test:whitebox        # 6/6 after
cd backend/notification-service && npm run test:whitebox  # 14/14 after
```

| Metric | Before | After |
|---|---|---|
| search-service white-box (sanitisation) | **red** — no sanitisation module existed | **6 / 6** |
| notification-service white-box (pin/validation/mail) | **red** — modules did not exist | **14 / 14** |

**Covered logic:**
- `sanitizeSearchParam` — rejects `{$ne:...}` / arrays, regex-escapes, trims, caps at 100.
- `sanitizePagination` — page ≥ 1, limit ∈ [1,100], bad input → defaults.
- `protect()` — HS256 pin, required `id`+`role`, 401 vs 403 semantics, `alg:none` rejection.
- `validateOrderDetails` — type/length/range bounds on every field.
- `sanitizeEmailField` — CR/LF stripping.
- `createTransport` — mock vs env-only config, no literals.
- `buildEmailMessage` — fixed subject/from, header-injection-proof body.
- Mongoose `User`/`RestaurantModel` schema invariants (role enum, email unique, required fields).

`npx tsc --noEmit` and ESLint (`eslint-plugin-security` + `no-unsanitized`) are clean in both services.

---

## 7. Additional open-source tool results

| Tool | Result |
|---|---|
| **Semgrep** custom taint rules (`nosql-unsafe-regex-input`, `jwts-verify-no-algorithm`, `res-500-with-internals`) | **0 findings** after (`semgrep-search-custom-after.json`, `semgrep-notif-custom-after.json`) |
| **Semgrep** default rule pack (pre-fix) | flagged `Dockerfile` running as root / no `USER` (still open — see §8) |
| **ESLint** security plugin | clean |
| **`npm audit`** (search-service) | **11 vulns** (1 low, 3 moderate, **7 high**) → **0** |
| **`npm audit`** (notification-service) | 0 → **0** |
| **gitleaks** | **21 hits before** (incl. real base64 creds in the two assessed manifests) → **17 after**, all in **out-of-scope sibling manifests** → **0 in scope** |

Evidence files: `docs/security/evidence/` (`semgrep-search-before.json`, `semgrep-search-custom-after.json`, `semgrep-notif-before.json`, `semgrep-notif-custom-after.json`, `audit-search-after.json`, `audit-notif-after.json`, `gitleaks-before.json`, `gitleaks-after.json`).

---

## 8. Vulnerabilities found but NOT fixed (and reasons)

| # | Finding | Reason it was not fixed |
|---|---|---|
| 1 | **Credential rotation** — the Gmail app password and MongoDB URIs previously committed (SRCH-08 / NOTIF-07) must actually be rotated/revoked | Not a code fix — an **operator/security action**. Rotation was flagged and documented in the manifest comments; it cannot be "done" in source, it requires the mailbox owner to regenerate the app password and DB access strings and re-inject via a secret manager. |
| 2 | **Out-of-scope sibling services** (cart, menu, delivery, admin, order, stripe, user) — their k8s manifests still contain real-looking credential material (17 gitleaks hits) | **Out of scope** for my contribution (search + notification + its frontend). The gitleaks allowlist deliberately covers **only** the two assessed manifests; fixing siblings is a group follow-up (see §10). |
| 3 | **Dockerfiles run as root** with `NODE_ENV=development` (Semgrep `missing-user`) | The two services are run locally via `npm run dev`; the containers are dev images, not the deployment path used by the assignment runtime. Fixing requires a multi-stage production image (`USER node`, `NODE_ENV=production`); deferred because it would change the dev workflow and is outside the assessed services' hardening scope. |
| 4 | **Per-recipient retry/queue** for notification fan-out (`Promise.all` one-shot) | Architectural change (message queue). Current design counts delivered/failed and fails loudly; a durable queue with retries was evaluated as a bigger change than needed for the sandbox requirement, so it remains a documented follow-up. |
| 5 | **Hardening of the other microservices** (rate limiting, CORS, headers, input validation for user-service, menu-service, order-service, etc.) | **Out of scope.** The assignment is a team project; each member owns a subset of services. Sibling services are run by other group members and are explicitly listed as cross-team follow-ups. |

---

## 9. Best practices that would have prevented these vulnerabilities

1. **Validate input at the boundary (never trust `req.*`).** Treat every query/body/param value as hostile; enforce types, lengths, ranges *before* it reaches a DB query or an e-mail template. A shared sanitisation utility + schema validation would have prevented SRCH-01/02, NOTIF-05 up front.
2. **Escape before interpolation.** Regex metacharacters must always be escaped before building `$regex` patterns; user text must never be concatenated into SMTP headers or templates (fixed subject/from).
3. **Default-deny everywhere.** CORS by allow-list, not `*`; JWT algorithms pinned explicitly; roles checked at the middleware; secrets referenced by name, never by value. The "secure by default" posture would have prevented SRCH-06/07, NOTIF-01/04/06.
4. **Do not commit secrets — ever.** Secrets belong in env/secret-manager/Helm; a `git-secrets`/gitleaks pre-commit hook would have blocked SRCH-08 and NOTIF-07 before they ever entered history.
5. **Bound every resource.** Limit responses, paginate, cap recipient lists, rate-limit public endpoints, and give queries a timeout (`maxTimeMS`) — prevents SRCH-03/04 and NOTIF-02/03.
6. **Fail loudly and generically to the client.** Central error handling should return static messages and log internals server-side; never send stack traces / `error.message` to the wire (SRCH-05, NOTIF-02).
7. **Security headers and fingerprint reduction are baseline hygiene.** Helmet + disabling `X-Powered-By` should be in the very first middleware of any Express app (SRCH-07).
8. **Dependency & SAST checks in CI.** `npm audit`, Semgrep, gitleaks and the black/white-box suites should run on every PR and **fail the build** — most of the above would have been caught at review time.
9. **Test security behaviour explicitly.** Write black-box tests that assert *secure* behaviour (400 not 500, no reflection, no stack traces) so regressions cannot silently re-introduce a vulnerability.

---

## 10. Summary of outcomes

| Metric | Before | After |
|---|---|---|
| Distinct vulnerabilities (this contribution) | 16 open | **0 open in scope** |
| search-service black-box | 10 pass / 10 fail | **20 / 20** |
| search-service white-box | red | **6 / 6** |
| notification-service black-box | 15 pass / 2 fail | **17 / 17** |
| notification-service white-box | red | **14 / 14** |
| `npm audit` (search) | 11 (7 high) | **0** |
| `npm audit` (notification) | 0 | **0** |
| Semgrep custom taint rules | firing | **0 findings** |
| gitleaks in-scope | 4 hits with real creds | **0** |

**Cross-team follow-ups (next iteration):** rotate the previously committed credentials; move all k8s `Secret` creation to Helm/secret-manager; extend the same hardening to the sibling services; add a CI gate that fails on `npm audit > 0`, Semgrep findings, gitleaks findings, and black-box regressions.

All fixes, tests, and evidence are committed in this repository under `backend/search-service/`, `backend/notification-service/`, `frontend/platoo-client/.../orders/page.tsx`, `backend/k8s/`, and `docs/security/` on branch `security/search-notification-hardening`.