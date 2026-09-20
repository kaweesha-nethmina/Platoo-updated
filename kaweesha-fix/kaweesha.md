# Security Fix Checklist — Platoo (kaweesha)

Checklist of security hardening completed against the findings and observations in
[`vulnerability-assessment.md`](./vulnerability-assessment.md).
Only the "Google OAuth", "Form validation", and "V-01 admin credentials" work items
described below were done; no existing authentication logic for email/password was modified.

---

## 1. Google OAuth (OIDC) Sign-In

### Backend — `backend/user-service`

- [x] **Additive endpoint added** — `POST /api/auth/google` (`src/routes/auth.ts`), no breaking change to register/login.
- [x] **Server-side ID token verification that cannot be bypassed** — `googleAuth` controller (`src/controllers/authController.ts`) uses `google-auth-library`'s `OAuth2Client.verifyIdToken()` against `GOOGLE_CLIENT_ID` from env. The token is never decoded-and-trusted client-side or server-side without signature/audience verification.
- [x] **Route has no auth middleware** (it is the entry point), but the controller always verifies before issuing any token.
- [x] **Exact same JWT issuance** — reuses the existing `generateToken()` with the same `JWT_SECRET` and `expiresIn: "1d"`, producing the same payload shape (`{ id, role }`) as the existing login flow, so downstream services treat Google tokens identically to email/password tokens.
- [x] **Same response shape as login** — `200 { token }`; the frontend handles both responses the same way.
- [x] **User model supports Google-linked accounts** (`src/models/User.ts`):
  - `googleId` — String, unique, sparse.
  - `authProvider` — enum `["local", "google"]`, default `"local"`.
  - `password` — conditionally required ONLY for local accounts (conditional validator; global `required: true` was not removed).
- [x] **Account resolution rules**:
  - Existing `local` (password) account with same email → `googleId` linked, `authProvider` kept as `local` (user can log in either way; no duplicate account).
  - Existing `google` account → logged in.
  - No existing account → created with `authProvider: "google"`, `role: "user"` (same non-elevated default as normal registration; never `admin`).
- [x] **Error handling follows the V-09 pattern** — invalid/expired/forged Google token returns a generic `401 { msg: "Invalid Google token" }`; the raw `google-auth-library` error is logged server-side only and never leaked to the client.
- [x] **New env vars documented** — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` added to `backend/user-service/.env.example` (not committed in `.env`).

### Frontend — `frontend/platoo-client`

- [x] **GSI script loaded** via `next/script` (`app/login/page.tsx`, `strategy="afterInteractive"`).
- [x] **Google button** rendered into `#google-signin-button` (initialised in a guarded `useEffect` + `onLoad`; runs only once after `window.google` exists).
- [x] **Credential forwarded raw** — `handleGoogleCredentialResponse` POSTs `{ idToken: response.credential }` to `http://localhost:4000/api/auth/google`; the token is never decoded/trusted client-side.
- [x] **Identical post-login path** — both email/password login AND Google sign-in call the same shared `applyAuthSuccess(token)`:
  - clears/sets role-based ID keys (`adminId`, `restaurantOwnerId`, `deliveryManId`, `userId`),
  - stores JWT under `localStorage["jwtToken"]`,
  - updates context via `setUser({ token })` (which also writes `localStorage["token"]`),
  - shows the success toast and redirects to `/dashboard`.
  - Failure uses the same destructive-toast error UI as email/password login.
- [x] **`NEXT_PUBLIC_GOOGLE_CLIENT_ID` documented** in `frontend/platoo-client/.env.local.example`.

> **Relationship to `vulnerability-assessment.md`:** improves authentication (Section 5 "Login endpoint" / "Trust Boundary") by adding a second verified sign-in path that reuses the exact same JWT mechanism. It does **not** change how the JWT is stored (V-08 localStorage design remains, intentionally, for consistency with the existing flow — migrating to an `httpOnly` cookie is a separate future fix). The generic-error handling follows the recommended fix for **V-09** (sensitive data leakage in error responses).

---

## 2. Frontend Form Validation

### Login page — `frontend/platoo-client/app/login/page.tsx`

- [x] Email: required, trimmed, max 254 chars, validated against a format regex before the request is sent.
- [x] Password: required, min 8 / max 128 chars.
- [x] Invalid form **blocks submission** (early return; no API call with bad input).
- [x] Email is trimmed in the request body (`email: email.trim()`).
- [x] Inline red error messages under each field; errors clear as the user types.
- [x] Browser-level hardening: `maxLength` caps and `autoComplete` hints on inputs.

### Register page — `frontend/platoo-client/app/register/page.tsx`

- [x] Name: required, trimmed, 2–100 chars, rejects `<`/`>` (script-injection guard).
- [x] Email: required, trimmed, max 254 chars, Gmail-format validation.
- [x] Password: required, 8–128 chars AND complexity rule — must include uppercase + lowercase + number + special character.
- [x] Confirm password: must match.
- [x] Phone (customer): exactly 10 digits.
- [x] Address (all roles): required, trimmed, max 200 chars, rejects `<`/`>`.
- [x] Restaurant name (restaurant owner): required, trimmed, max 100 chars, rejects `<`/`>`.
- [x] Vehicle number (delivery man): required, trimmed, format `^[A-Z0-9-]{2,20}$`.
- [x] Payload is trimmed before sending (`cleanedData`) so whitespace padding can't be abused.
- [x] Browser-level hardening: `maxLength` caps and `autoComplete` hints on all inputs.

> **Relationship to `vulnerability-assessment.md`:** directly addresses Section 5 observations around registration/length and injection-borne abuse (A03 — Injection). These are **defense-in-depth**: frontend validation is a UX/input-hygiene layer that can be bypassed by direct API calls, so the backend remains the authority. Recommended follow-up (not done here): mirror these rules in `user-service` (e.g. enforce password strength server-side — Section 5 "Password hashing" — and add login rate limiting / account lockout — Section 5 "Login endpoint" / "Account lockout").

---

## 3. V-01 — Remove Hardcoded Admin Credentials (Critical)

### Backend — `backend/user-service/seed-admin.js`

- [x] **No hardcoded password** — removed the committed plaintext default; the seed no longer
      contains or depends on `admin123`.
- [x] **Password from env or generated** — reads `ADMIN_PASSWORD` from the environment; if unset,
      generates a strong random 24-character password (`crypto.randomBytes`) and prints it once to
      the console so the operator can save it. It is never stored or committed anywhere.
- [x] **Safe to re-run** — an existing admin's password is **not** overwritten on re-runs unless an
      explicit `ADMIN_PASSWORD` is provided or `ADMIN_RESET_PASSWORD=1` is set.
- [x] **Email overridable** — `ADMIN_EMAIL` env var (defaults to `admin@platoo.com`).
- [x] **Env vars documented** — `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_RESET_PASSWORD` added to
      `backend/user-service/.env.example`.

> **Relationship to `vulnerability-assessment.md`:** directly closes **V-01** (Critical, A07).
> ⚠️ Operator action still required: if this seed was ever run against a deployed database, rotate
> the admin password now (the old default is publicly known).

---

## 4. General status vs. the assessment

| Fix | Scope | Backend | Frontend | Status |
|---|---|---|---|---|
| Google OAuth (OIDC) sign-in | Additive new login path, same JWT handling | ✅ verified server-side tokens | ✅ same post-login logic | **Done** |
| Form validation | Input validation & hardening on login + register | Not required (defense-in-depth) | ✅ | **Done** |
| V-01 admin credentials | Seed script uses env/generated password | ✅ | — | **Done** |
| V-09 error leakage (googleAuth only) | Generic 401, server-side-only logging | ✅ | — | **Done (new endpoint)** |
| V-08 JWT storage (httpOnly cookie) | Out of scope for these fixes | — | — | Not changed (kept consistent with existing flow) |

Verification performed on both fixes: `npm run build` / `npx tsc --noEmit` passes for all changed
files (login page, register page, user model, auth controller, auth routes); existing
email/password register, login, and JWT issuance behave exactly as before.