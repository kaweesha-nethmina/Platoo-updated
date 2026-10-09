# Search-service — Security Assessment & Hardening (SE4030)

**Service:** `backend/search-service` — REST search API, port **3002**
**Branch:** `security/search-notification-hardening`
**Scope:** black-box + white-box testing, source review, SAST (Semgrep), dependency audit (npm), secret scanning (gitleaks).

---

## 1. Running the service and the test suites

```bash
# service (nodemon + ts-node)
npm install
npm run dev                       # listens on :3002, MongoDB at MONGO_URI

# suites
npm test                          # white-box (jest, with coverage)
npm run test:blackbox             # black-box (needs a running service + seeded data + menu service on :3001)
npm run test:security             # eslint + npm audit
npx tsc --noEmit                  # type-check
```

Runtime configuration lives in `.env` (and can be overridden):

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP port | `3002` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/platoo_search` |
| `MENU_SERVICE_URL` | menu-service base URL | `http://localhost:3001` |
| `CLIENT_URL` | comma-separated CORS allow-list | `http://localhost:3000` |
| `RATE_LIMIT_WINDOW_MS` | rate-limit window | `60000` |
| `RATE_LIMIT_MAX` | max requests per window per IP | `20` |

---

## 2. Vulnerability register

| ID | Finding | CWE | CVSS v3.1 | Status |
|---|---|---|---|---|
| SRCH-01 | NoSQL operator injection via `req.query.*` (Mongo `$regex` can host `{$gt: ...}` etc.) | 943 (Improper Neutralization in the special elements of a Mongo query) | 5.3 | **Fixed** |
| SRCH-02 | User input placed verbatim into `RegExp` (catastrophic-backtracking ReDoS) | 1333 / 400 | 5.3 | **Fixed** |
| SRCH-03 | Unbounded results (no `limit`, no pagination cap) → resource exhaustion | 770 | 5.3 | **Fixed** |
| SRCH-04 | No rate limiting on public endpoints | 799 / 770 | 3.1 | **Fixed** |
| SRCH-05 | Stack traces / internal error text surfaced in HTTP responses | 209 / 200 | 6.5 | **Fixed** |
| SRCH-06 | `cors()` default `*` reflected `Access-Control-Allow-Origin` | 942 / 346 | 4.3 | **Fixed** |
| SRCH-07 | Missing security headers + `X-Powered-By` fingerprint | 693 / 200 | 3.1 | **Fixed** |
| SRCH-08 | Live MongoDB URI committed as base64 in k8s Secret | 798 | 9.8 | **Fixed** |

### 2.1 Evidence reproduced by the suites

| Check (black-box) | Where | Result after fix |
|---|---|---|
| `query[$regex]=^.*` operator object rejected | tests/blackbox | 400 (was 500 / leak) |
| `{$ne:""}`-style payloads rejected | tests/blackbox | 400 |
| `(a+)+$` query does not hang / no stack trace | tests/blackbox | fast 200/400/404 |
| broad `query=.` bounded to ≤ 100 rows | tests/blackbox | 200/404, ≤ 100 |
| unknown `Origin` is not reflected | tests/blackbox | no `access-control-allow-origin` |
| security headers present, `X-Powered-By` absent | tests/blackbox | present / absent |
| oversized body → JSON error, no stack | tests/blackbox | 413 JSON |
| 30 requests in a row → 429 (abuse, runs last) | tests/blackbox | 429 |

White-box suite (`tests/whitebox`): 6/6 passing — covers `sanitizeSearchParam` (metachar escaping, non-string/operator rejection, length cap), `sanitizePagination` (page/limit clamps) and schema validation.

---

## 3. What was changed

### SRCH-01 / SRCH-02 — input sanitisation (`src/utils/sanitize.ts`, `src/controllers/search.controller.ts`)
- `sanitizeSearchParam()` converts non-string (object/array) values to `null`, trims, caps length at 100 and **regex-escapes** every metacharacter before the value is used inside `$regex`.
- `sanitizePlainText()` for the category search, `sanitizePagination()` clamps `page >= 1`, `limit` to `[1, 100]`.
- Removed dead duplicate search handlers (`handleRestaurantSearch`/`searchRestaurants` in the service) so only one sanitised path exists.
- `express-mongo-sanitize`/`hpp` were trialled but removed — the explicit string-cap + escape step is stronger, dependency-light and keeps the libs minimal.

### SRCH-03 — bounded + timed queries
- `.skip((page-1)*limit).limit(limit).maxTimeMS(2000)` in `search.controller.ts:47-50`.

### SRCH-04 — rate limiting (`src/app.ts`)
- `express-rate-limit`, per IP, `RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`, JSON 429 body, `standardHeaders` + `legacyHeaders` (RateLimit-* headers) so clients can self-throttle.

### SRCH-05 — central error handling (`src/app.ts`)
- JSON 404 for unknown routes; central error handler maps `entity.too.large` → **413**, `entity.parse.failed` → **400**, everything else → generic `500` “Internal Server Error”. Full details go to server logs only.
- `express.json({ limit: '100kb' })`.

### SRCH-06 — CORS allow-list
- `CLIENT_URL` (default `http://localhost:3000`), unknown origins get no CORS headers; preflight for unknown origin does not echo the origin.

### SRCH-07 — headers
- `helmet()` and `app.disable('x-powered-by')`.

### SRCH-08 — secrets in `backend/k8s/search-service.yaml`
- Base64 `MONGO_URI` replaced by `stringData` placeholder `<replace-with-rotated-mongo-uri>` with a rotation warning comment. The real credential must be injected via `kubectl create secret` / Helm.

---

## 4. SAST / SCA / secrets tooling

- **Semgrep (custom rules, `.semgrep/custom.yml`):** `nosql-unsafe-regex-input` (taint: `req.*` → `$regex`), `res-500-with-internals` (taint: `error.*` → 500). Post-fix: **0 findings** (`evidence/semgrep-search-custom-after.json`).
- **ESLint** (`eslint.config.mjs`, `eslint-plugin-security`): clean.
- **`npm audit`:** **0 vulnerabilities** after fixing the axios/mongoose/express + dev-glob advisories (`evidence/audit-search-after.json`). Baseline: 11 (1 low, 3 moderate, 7 high).
- **gitleaks:** 0 findings in scope (`evidence/gitleaks-after.json`); the 17 remaining findings are all in **out-of-scope** sibling services (cart/menu/delivery/admin/order/stripe/user manifests). Allowlist only covers the two assessed manifests, which contain placeholders, never secrets.

## 5. Evidence files (`docs/security/evidence/`)

- `semgrep-search-before.json`, `semgrep-search-custom-after.json`
- `audit-search-after.json`
- `gitleaks-before.json`, `gitleaks-after.json`

## 6. Recommended follow-ups

- Rotate any credential that once existed in any k8s manifest (search-service had one).
- Wire `MENU_SERVICE_URL` / `CLIENT_URL` via a secrets/config manager in production.
- Extend the same hardening to the sibling services (their manifests still contain real-looking credentials — see gitleaks justification in `SECURITY-ASSESSMENT-README.md`).