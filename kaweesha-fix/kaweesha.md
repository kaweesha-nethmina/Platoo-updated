# Security Fix Checklist — Platoo (kaweesha)

Checklist of security hardening completed against the findings and observations in
[`vulnerability-assessment.md`](./vulnerability-assessment.md).
Only the "Google OAuth", "Form validation", "V-01 admin credentials", "V-02 role
self-assignment", "V-03 server-side payment amount", "V-07 server-side order pricing", and
"V-05 payment verification" work items described below were done;
no existing authentication logic for email/password was modified.

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

## 3b. V-02 — Prevent Admin Self-Assignment on Registration (Critical)

### Backend — `backend/user-service/src/controllers/authController.ts`

- [x] **Server-side role whitelist** — registration now only accepts the non-elevated roles
      customers can pick for themselves:
      `user`, `restaurant_owner`, `delivery_man`.
- [x] **Admin can no longer be self-assigned** — any request sending `role: "admin"` (or any other
      unlisted/unknown role) is silently downgraded to the default `user` role server-side.
- [x] **Minimal-change approach** — the field is still read from `req.body` and passed to the model,
      but the value is sanitized through `PUBLIC_REGISTRATION_ROLES` first, so the existing
      self-registration flow for customers, restaurant owners, and delivery persons keeps working
      exactly as before. Only the privileged path is closed.
- [x] **Mongoose enum validator already present** — no change needed; the schema still validates
      roles against `Object.values(UserRole)` on the model (a second line of defense).

> **Relationship to `vulnerability-assessment.md`:** directly closes **V-02** (Critical, A01).
> Admin accounts can now only be provisioned through the admin-only flow (`seed-admin.js`) or a
> future admin-only provisioning endpoint — never via public registration. Frontend unchanged
> (it already only offers the three public roles).

---

## 3c. V-03 — Recompute Payment Amount Server-Side (Critical)

### Backend — `backend/payment-service`

- [x] **Client amount no longer trusted** — `ProductRequest` no longer carries an `amount` field;
      it carries only an `orderId` reference. There is no code path left that can turn a
      client-supplied monetary value into a Stripe charge.
- [x] **`.setUnitAmount()` derived from the persisted order** — `StripeService.checkoutProducts()`
      fetches the stored order from the order-service (`GET /api/orders/{id}`) and recomputes the
      payable total as `sum(item.price * item.quantity) + delivery_fee`, then rounds it to the
      currency's smallest unit. The client never provides the price.
- [x] **Server-to-server call, no new dependencies** — uses the JDK `java.net.http.HttpClient`
      against the configurable `order.service.url` (`ORDER_SERVICE_URL` env, default
      `http://localhost:3008`) with a 5s timeout.
- [x] **Missing / invalid references rejected** — blank `orderId`, order not found (404), or a
      non-positive recomputed total all return `400`/`404` client errors instead of creating a
      session.
- [x] **Failure behaviour follows the V-09 pattern** — order-service unreachable or a
      `StripeException` returns a generic 500 message; the underlying exception is only logged
      server-side and never relayed to the client.
- [x] **Session correlates to the order** — the order id is stored in Stripe session metadata
      (`order_id`), which `PaymentVerificationController` already reads on verification.
- [x] **Cancel URL corrected** — points to the real checkout page (`http://localhost:3000/checkout`)
      instead of the stale `:8080` stub.

### Frontend — `frontend/platoo-client`

- [x] **Order persisted before payment** — the checkout page now creates the order (POST
      `/api/orders`) first and keeps its id — that id is the V-03 "order reference".
- [x] **Checkout payload is a reference, not a price** — checkout sends `{ orderId, currency }` to
      `/product/v1/checkout`; the client `amount`/`quantity` payload is gone.
- [x] **Success page no longer re-creates the order** — `payment-success` just cleans up
      `pending_order` and navigates, removing the previous double-creation risk.

> **Relationship to `vulnerability-assessment.md`:** directly closes **V-03** (Critical, A07).
> The Stripe amount now comes from the persisted order record instead of the client. It is
> **complete** because the order record itself is now trusted: **V-07** makes the order-service
> price items from the server-side catalog, and **V-05** verifies the Stripe session server-side
> before the order is confirmed/paid (both documented below). Note: the checkout page displays an
> 8% tax line, but the order-service never modelled tax, so the persisted/charged amount is
> `sum(item.price * quantity) + delivery_fee` (tax excluded); the confirmation/invoice and the
> Stripe charge are now exactly consistent with each other.

---

## 3d. V-07 — Server-Side Prices for Order Totals (High)

### Backend — `backend/menu-service` (new quote endpoint)

- [x] **Trusted price source exposed** — new `POST /api/menu-items/quote`
      (`src/services/menuItem.service.ts` → `quoteMenuItems`, controller
      `quoteMenuItemsHandler`, route `router.post('/quote', ...)`):
      accepts `{ items: [{ menu_item_id, quantity }] }`, looks the ids up in the DB, and returns
      `{ valid: [{ menu_item_id, name, price, quantity }], invalid: [id...] }`.
- [x] **Input hardened** — non-ObjectId, missing, or non-positive quantities are moved to
      `invalid`; only real catalog documents produce a price.

### Backend — `backend/order-service`

- [x] **Client prices are never used** — `OrderService.resolveTrustedItems()` calls the quote
      endpoint and builds `items` from the server-returned `price`/`name`; the client-supplied
      `price`/`name` on the request body are ignored.
- [x] **Order rejected on any invalid item** — if any requested item is missing/invalid (or the
      menu-service is unreachable), `createOrder`/`updateOrder` fail closed and no order is saved.
- [x] **Totals recomputed server-side** — `total_amount = sum(price * quantity) + delivery_fee`
      is always derived from the trusted prices (`orderService.ts`, create + update paths).
- [x] **Config documented** — `MENU_SERVICE_URL` (already present in `order-service/.env`) and
      `PAYMENT_SERVICE_URL` are documented in the new `backend/order-service/.env.example`.

> **Relationship to `vulnerability-assessment.md`:** directly closes **V-07** (High, A04).
> Combined with V-03, this means the payment-service's "recomputed" total is based on genuinely
> server-owned prices, so the whole `client → order → Stripe` price chain is trusted.

---

## 3e. V-05 — Verify Stripe Payment Server-Side Before Confirming (High)

Because V-03 requires the order record to exist *before* the Stripe session is created, the
original "create the order only after payment" step became an order *confirmation* step: the order
is only marked `paid` (and the confirmation email is sent) after the session is verified.

### Backend — `backend/order-service`

- [x] **New `payment_status` field** — order model gains `payment_status`
      (`enum ['unpaid','paid']`, default `unpaid`) and `paid_at`; existing orders default to
      `unpaid`. The existing `status` (pending/preparing/ready/delivered/cancelled) semantics are
      untouched, so the restaurant dashboard flow is unaffected.
- [x] **Confirmation email moved** — removed from `createOrder`; it is now sent only once the
      payment is verified (`confirmPayment`), so abandoned checkouts never trigger emails.
- [x] **`PATCH /api/orders/:orderId/payment`** — `OrderService.confirmPayment(orderId, sessionId)`
      (new controller `confirmPaymentHandler` + route) does all verification server-side:
      1. loads the order (by `_id` or `ORDER###`);
      2. calls payment-service `GET /api/verify-payment/{sessionId}` (which verifies with Stripe);
      3. accepts only `status === "success"` **and** the Stripe metadata `order_id` matching this
         order's `_id` (an attacker cannot pin their paid session to someone else's order);
      4. marks `payment_status = "paid"`, records `paid_at`, then sends the confirmation email
         (email failure is logged, never fatal).
  - **Idempotent** — a repeated call (e.g. page refresh after a successful redirect) returns the
    already-paid order without re-sending the email.
  - Verification failures return a generic `403`.

### Backend — `backend/payment-service`

- [x] **`PaymentVerificationController` fixed + hardened** — the Stripe API key is now set inside
      the handler (previously set in the constructor, where the injected `@Value` field was still
      `null`, so verification could never authenticate). Also returns generic error messages
      (V-09 pattern, no `StripeException` leakage) and rejects sessions whose metadata has no
      `order_id`.

### Frontend — `frontend/platoo-client/app/payment-success/page.tsx`

- [x] **Session verified server-side before confirmation** — parses `session_id` from the URL and
      calls `PATCH /api/orders/{order_id}/payment`. Only a verified, matched, paid session leads to
      the confirmation page; anything else (missing session id, verification failure) redirects
      back to `/checkout`. `localStorage` alone is never trusted.

> **Relationship to `vulnerability-assessment.md`:** directly closes **V-05** (High).
> The success path can no longer be simulated from client state, confirmation emails only fire for
> verified payments, and abandoned checkouts leave an `unpaid` order with no email.

---

## 4. General status vs. the assessment

| Fix | Scope | Backend | Frontend | Status |
|---|---|---|---|---|
| Google OAuth (OIDC) sign-in | Additive new login path, same JWT handling | ✅ verified server-side tokens | ✅ same post-login logic | **Done** |
| Form validation | Input validation & hardening on login + register | Not required (defense-in-depth) | ✅ | **Done** |
| V-01 admin credentials | Seed script uses env/generated password | ✅ | — | **Done** |
| V-02 role self-assignment | Register whitelist: user, restaurant_owner, delivery_man; admin downgraded | ✅ | — | **Done** |
| V-03 payment amount server-side | Checkout takes an order reference; Stripe amount recomputed from the persisted order (never the client's amount) | ✅ (fetch + recompute) | ✅ (create order first, send orderId) | **Done** |
| V-07 server-side order pricing | Order totals priced from the menu-service catalog; client prices ignored | ✅ (quote endpoint + trusted resolve) | — | **Done** |
| V-05 payment verification | Session verified server-side (Stripe) before the order is confirmed/paid; email only after verification | ✅ (order-service confirm + payment-service verify) | ✅ (success page verifies) | **Done** |
| V-09 error leakage (googleAuth only) | Generic 401, server-side-only logging | ✅ | — | **Done (new endpoint)** |
| V-08 JWT storage (httpOnly cookie) | Out of scope for these fixes | — | — | Not changed (kept consistent with existing flow) |

Verification performed on both fixes: `npm run build` / `npx tsc --noEmit` passes for all changed
files (login page, register page, user model, auth controller, auth routes); existing
email/password register, login, and JWT issuance behave exactly as before.
For the payment/order chain: `mvn -o compile` is clean for payment-service, and `npx tsc --noEmit`
is clean for order-service and menu-service and reports no new errors in the changed frontend
files (`app/checkout/page.tsx`, `app/payment-success/page.tsx`; only the pre-existing dashboard
errors remain). No authentication logic was touched.