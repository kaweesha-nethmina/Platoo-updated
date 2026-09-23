# Notification-service — Security Assessment & Hardening (SE4030)

**Service:** `backend/notification-service` — delivery-notification API, port **4006**
**Branch:** `security/search-notification-hardening`
**Scope:** black-box + white-box testing, source review, SAST (Semgrep), dependency audit (npm), secret scanning (gitleaks). One additional finding (`F-01`) lives in the frontend that calls this service.

---

## 1. Running the service and the test suites

```bash
# service (ts-node-dev)
npm install
npm run dev                       # listens on :4006, MongoDB at MONGO_URI
# dev/sandbox e-mail: set SMTP_TRANSPORT=mock (jsonTransport, no network).
# see .env; production uses real SMTP_* / EMAIL_* variables.

# suites
npm run test:whitebox
npm run test:blackbox             # needs a running service + seeded delivery users
npm run test:security             # eslint + npm audit
npx tsc --noEmit
```

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP port | `4006` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/platoo_notifications` |
| `JWT_SECRET` | HS256 signing secret (**required** — service refuses to boot without it) | — |
| `CLIENT_URL` | CORS allow-list | `http://localhost:3000` |
| `RATE_LIMIT_WINDOW_MS` | rate-limit window | `60000` |
| `RATE_LIMIT_MAX` | requests per window per IP+user | `25` |
| `MAX_NOTIFICATION_RECIPIENTS` | per-request delivery-recipient cap | `50` |
| `SMTP_TRANSPORT` | `mock` → nodemailer JSON transport (sandbox) | unset (real SMTP) |
| `SMTP_HOST` / `SMTP_PORT` | SMTP endpoint | `smtp.ethereal.email` / `587` |
| `EMAIL_USER` / `EMAIL_PASS` | SMTP app credentials | unset |

---

## 2. Vulnerability register

| ID | Finding | CWE | CVSS v3.1 | Status |
|---|---|---|---|---|
| NOTIF-01 | `jwt.verify()` without pinned algorithm — alg confusion (`alg:none`, HS/RS confusion) | 347 | 3.1 | **Fixed** |
| NOTIF-02 | Email-fan-out amplification (unbounded recipients) + silent SMTP failures reported as success | 770 / 703 | 5.4 | **Fixed** |
| NOTIF-03 | Monolithic per-IP limiter (a burst from one client throttled all users incl. frontend) | 799 / 770 | 5.3 | **Fixed** |
| NOTIF-04 | Disallowed CORS `Origin` produced a 500 (malformed/in-scope error) | 346 / 200 | 4.3 | **Fixed** |
| NOTIF-05 | CRLF / HTML injection into e-mail via `orderDetails.customer.*` (header injection / scripted body) | 80 / 93 | 4.3 | **Fixed** |
| NOTIF-06 | Hard-coded Gmail “service” + committed-style credentials in `mailer.ts` | 547 | 4.3 | **Fixed** |
| NOTIF-07 | Gmail app password + MongoDB URI committed in k8s Secret | 798 | 9.8 | **Fixed** |
| F-01 | Frontend 4006 call missing `Authorization` header → feature broken after auth hardening | 306 | — | **Fixed** |

### 2.1 Evidence reproduced by the suites

| Check (black-box) | Result after fix |
|---|---|
| request without token → 401 | pass |
| role `user` token → 403 | pass |
| forged / expired / `alg:none` tokens → 401 | pass |
| authorised admin triggers a notification → 200 | pass (mock transport) |
| missing/oversized/bad-typed `orderDetails` → 400 | pass |
| > 10 kb body / malformed JSON → 4xx JSON, no stack trace | pass |
| CRLF-looking customer text cannot break the JSON contract | pass |
| HTML-looking payload does not return markup | pass |
| `X-Powered-By` disabled, helmet headers present | pass |
| disallowed `Origin` → **403** JSON (not 500) | pass |

White-box suite: **14/14** passing — `protect()` (pin to HS256, required `id`/`role`, 401 vs 403 semantics), `validateOrderDetails`, `sanitizeEmailField`, `createTransport` (no literal creds), `buildEmailMessage` (fixed subject/from, header-injection proof), User schema.

---

## 3. What was changed

### NOTIF-01 — JWT verification hardening (`src/middleware/auth.ts`, `src/app.ts`)
- `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })`; token rejected unless `id` is a non-empty string and `role` ∈ `{admin, restaurant_owner}`.
- `app.ts` fails fast on startup if `JWT_SECRET` is missing.
- Ineligible role → **403**; missing/invalid token → **401** (both JSON).

### NOTIF-02 — e-mail fan-out + failure semantics (`src/services/notificationService.ts`)
- Recipients capped by `MAX_NOTIFICATION_RECIPIENTS` (default 50); truncation is logged.
- Per-recipient successes/failures are counted; **zero-delivery now returns a 5xx** instead of lying with 200.
- Per-recipient `sendMail` errors are collected, never silently swallowed.
- Task says “e-mail sandbox or mock service” — `SMTP_TRANSPORT=mock` uses nodemailer JSON transport (no network) locally/CI while production uses real SMTP env config.

### NOTIF-03 — rate limiter (`src/middleware/rateLimiter.ts`)
- Replaced Map-across-IP with `express-rate-limit`, keyed by **IP + decoded user id** (Bearer token), env-configurable window/limit, standard rate-limit headers, JSON 429.
- IPv4-mapped-IPv6 keys normalised (avoids `ERR_ERL_KEY_GEN_IPV6`).

### NOTIF-04 — CORS denial (`src/app.ts`)
- Disallowed origins answered with a clean **403 JSON** (“Origin not allowed”); the middleware no longer routes CORS failures into the generic 500.

### NOTIF-05 — content sanitisation (`src/utils/validation.ts`, `src/utils/mailer.ts`)
- `validateOrderDetails`: `id` 1–64, `total` finite in `[0, 1e9]`, name ≤ 128, address ≤ 256.
- `sanitizeEmailField`: strips `\r\n` sequences entirely (a bare `\n` becomes a space) so a customer string can never become e-mail headers or trailing headers.
- `buildEmailMessage` uses a **fixed subject/from**; all user content is confined to the plain-text body.

### NOTIF-06 — injectable transport (`src/utils/transport.ts`, `src/utils/mailer.ts`)
- `createTransport(opts)` reads only options or `SMTP_*`/`EMAIL_*` env (+ explicit `verbose`/`SMTP_TRANSPORT=mock` json transport). No hard-coded Gmail service/credentials anywhere.
- Transport is created lazily so it always sees `dotenv.config()` output.

### NOTIF-07 — secrets in `backend/k8s/notification-service.yaml`
- Base64 Gmail user/app-password + MongoDB URI replaced by `stringData` placeholders (`<replace-with-rotated-mongo-uri>`, `<replace-with-mailbox-user>`, `<replace-with-app-password>`) with rotation guidance. **Rotate the real app password immediately.**

### F-01 — frontend (`frontend/platoo-client/app/dashboard/restaurant/orders/page.tsx`)
- The 4006 notification POST now sends `Authorization: Bearer <jwtToken>` (same token source as the rest of the app), restoring the flow after NOTIF-01.

---

## 4. SAST / SCA / secrets tooling

- **Semgrep (`.semgrep/custom.yml`):** taint rules for `req.* → $regex`, `jwt.verify` w/o algorithm pin, `error.* → res.status(500)`. Post-fix: **0 findings**.
- **ESLint** (`eslint-plugin-security` + no-unsanitized): clean.
- **`npm audit`:** **0 vulnerabilities** (baseline 0 too).
- **gitleaks:** 0 findings in scope (allowlist justified in `SECURITY-ASSESSMENT-README.md`).

## 5. Evidence files (`docs/security/evidence/`)

- `semgrep-notif-before.json`, `semgrep-notif-custom-after.json`
- `audit-notif-after.json`
- `gitleaks-before.json`, `gitleaks-after.json`

## 6. Recommended follow-ups

- Rotate the Gmail application password that was previously committed.
- Wire real SMTP credentials through a secret manager in production; keep `SMTP_TRANSPORT=mock` only for dev/CI.
- Consider a queue (per-recipient retry) rather than `Promise.all`-style one-shot fan-out.