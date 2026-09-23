# Security To-Do / Completed Work — Search & Notification Services (SE4030)

**Branch:** `security/search-notification-hardening`
**Scope:** black-box + white-box testing, source review, SAST (Semgrep), dependency audit (npm), secret scanning (gitleaks).

All items below are **DONE** unless marked otherwise. Separate reports: `SEARCH-SERVICE-SECURITY-README.md`, `NOTIFICATION-SERVICE-SECURITY-README.md`, `SECURITY-ASSESSMENT-README.md`.

---

## Search Service (`backend/search-service`, port 3002)

### Findings addressed
- [x] **SRCH-01** — NoSQL operator injection via `req.query.*` (CWE-943). Sanitised + regex-escaped input before `$regex`; non-string/object/array values rejected. `src/utils/sanitize.ts`, `src/controllers/search.controller.ts`.
- [x] **SRCH-02** — User input placed verbatim into `RegExp` → ReDoS (CWE-1333/400). Metacharacter escaping + length cap (100).
- [x] **SRCH-03** — Unbounded results / resource exhaustion (CWE-770). `skip/limit/maxTimeMS(2000)` pagination, `limit` clamped to `[1, 100]`.
- [x] **SRCH-04** — No rate limiting (CWE-799/770). `express-rate-limit` per IP, env-configurable window/max, JSON 429 + `RateLimit-*` headers. `src/app.ts`.
- [x] **SRCH-05** — Stack traces / internal error text leaked (CWE-209/200). Central JSON error handler (404/413/400/500 generic); details to server logs only.
- [x] **SRCH-06** — CORS default `*` reflection (CWE-942/346). `CLIENT_URL` allow-list; unknown origins get no CORS headers.
- [x] **SRCH-07** — Missing security headers + `X-Powered-By` (CWE-693/200). `helmet()`, `app.disable('x-powered-by')`.
- [x] **SRCH-08** — Live MongoDB URI in k8s Secret (CWE-798, CVSS 9.8). Replaced with `stringData` placeholder `<replace-with-rotated-mongo-uri>` in `backend/k8s/search-service.yaml`.

### Tests & verification
- [x] Black-box suite: **20/20** (operator injection → 400, ReDoS payload fast, results bounded ≤ 100, CORS not reflected, headers present, 413 JSON body, 429 rate-limit).
- [x] White-box suite: **6/6** (`sanitizeSearchParam`, `sanitizePagination`, schema validation).
- [x] `npx tsc --noEmit` clean.
- [x] ESLint (incl. `eslint-plugin-security`) clean.
- [x] `npm audit`: **0 vulnerabilities** (baseline 11: 1 low, 3 moderate, 7 high).
- [x] Semgrep custom taint rules (`nosql-unsafe-regex-input`, `res-500-with-internals`): **0 findings** after fix.
- [x] gitleaks: **0 findings in scope**.

---

## Notification Service (`backend/notification-service`, port 4006)

### Findings addressed
- [x] **NOTIF-01** — JWT algorithm confusion (`alg:none`, HS/RS) (CWE-347). `jwt.verify(..., { algorithms: ['HS256'] })`, checks `id` + `role ∈ {admin, restaurant_owner}`; 403 for ineligible role, 401 for invalid; fails fast if `JWT_SECRET` missing. `src/middleware/auth.ts`, `src/app.ts`.
- [x] **NOTIF-02** — E-mail fan-out amplification + silent SMTP failures (CWE-770/703). Recipients capped (`MAX_NOTIFICATION_RECIPIENTS`=50), per-recipient success/failure counted, zero-delivery → 5xx, errors never swallowed. `src/services/notificationService.ts`.
- [x] **NOTIF-03** — Monolithic per-IP limiter throttling all users (CWE-799/770). Per **IP + user id** keying via `express-rate-limit`, env-configurable, JSON 429, IPv4-mapped-IPv6 normalised. `src/middleware/rateLimiter.ts`.
- [x] **NOTIF-04** — Disallowed CORS Origin → 500 (CWE-346/200). Clean **403 JSON** “Origin not allowed”. `src/app.ts`.
- [x] **NOTIF-05** — CRLF / HTML injection into e-mails (CWE-80/93). `sanitizeEmailField` strips `\r\n`; `validateOrderDetails` bounds/validates fields; fixed subject/from, content confined to plain-text body. `src/utils/validation.ts`, `src/utils/mailer.ts`.
- [x] **NOTIF-06** — Hard-coded Gmail service + committed-style credentials (CWE-547). Injectable `createTransport(opts)` from `SMTP_*`/`EMAIL_*` env only, lazy creation; `SMTP_TRANSPORT=mock` JSON transport for dev/CI. No hard-coded creds.
- [x] **NOTIF-07** — Gmail app password + MongoDB URI in k8s Secret (CWE-798, CVSS 9.8). `stringData` placeholders in `backend/k8s/notification-service.yaml`.
- [x] **F-01** — Frontend 4006 call missing `Authorization` header (CWE-306). `frontend/platoo-client/.../restaurant/orders/page.tsx` now sends `Authorization: Bearer <token>`.

### Tests & verification
- [x] Black-box suite: **17/17** (401/403/auth semantics, 200 on authorised notification with mock transport, 400 bad `orderDetails`, 4xx JSON no stack, CRLF/HTML-safe, 403 bad origin).
- [x] White-box suite: **14/14** (`protect()` HS256 pin, `validateOrderDetails`, `sanitizeEmailField`, `createTransport`, `buildEmailMessage`, User schema).
- [x] `npx tsc --noEmit` clean.
- [x] ESLint (incl. `eslint-plugin-security`) clean.
- [x] `npm audit`: **0 vulnerabilities** (baseline 0 too).
- [x] Semgrep custom taint rules (incl. `jwt.verify` w/o algorithm pin): **0 findings** after fix.
- [x] gitleaks: **0 findings in scope**.

---

## Cross-cutting
- [x] Evidence copied to `docs/security/evidence/` (semgrep before/after ×2, npm audit after ×2, gitleaks before/after). Raw secret values redacted in committed gitleaks reports.
- [x] Branch pushed: `security/search-notification-hardening` on GitHub (push protection pass).
- [ ] **Follow-ups (out of scope / not done):** rotate credentials that were previously committed (search Mongo URI, notification Gmail app password); wire secrets via k8s Secret / secrets manager; extend same hardening to sibling services (cart/menu/delivery/admin/order/stripe/user — their manifests still contain real-looking credentials); consider a per-recipient retry queue for notification fan-out.