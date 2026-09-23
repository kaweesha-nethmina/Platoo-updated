# Fix To-Do (planning only — no fixes implemented)

None of these items are done. Order is dependency-first: a finding that other items rely on is listed before them (e.g. real auth middleware before any role/ownership check).

## Cross-cutting (do first)

- [ ] K-02: Rotate/secret-handling — all three services — move the Gmail app-password and the shared MongoDB credentials out of plaintext `.env` into a secrets store / deployment-time env injection; give each service its own least-privilege MongoDB user; stop emailing plaintext passwords (send passwordless invite links instead).
- [ ] K-13: Error handling hardening — all three services — add a JSON error middleware that logs stacks server-side and returns generic messages + correlation IDs; set `NODE_ENV=production` in every deployment.

## geo-location-service

- [ ] K-10: Implement real JWT verification middleware — geo-location-service — replace the `next(); // Bypass for development` stub with middleware that parses and verifies a user-service-issued JWT and attaches the verified identity to the request; apply it to all `/api/location/*` routes. This is the foundation for K-11/K-12 on HTTP.
- [ ] K-09: Authenticate Socket.io handshakes + authorize room joins — geo-location-service — verify the JWT during socket connection (`io.use`); on `order:track`, only join `order_<id>` if the caller owns the order or is the assigned driver; only admit `role==='admin'` sockets to `admin_monitoring`; set an explicit socket CORS allowlist.
- [ ] K-11: Stop driver-location spoofing — geo-location-service — derive `driverId` from the verified socket identity instead of the event payload; validate that the driver is assigned to `orderId` before persisting/broadcasting; range-check coordinates. Depends on K-10/K-09.
- [ ] K-12: Protect `/get-directions` — geo-location-service — apply the auth middleware (K-10), validate lat/lng as finite numbers in valid ranges, add per-IP/per-key rate limiting and response caching for the OSRM calls.
- [ ] Deps (geo-location-service): upgrade `axios`, `mongoose`, `engine.io`, `socket.io-parser`, `ws`, `socket.io-adapter`, `path-to-regexp`, `brace-expansion`, `form-data` per audit (advisory IDs in `kalana-fix/vulnerability.md`).

## delevery-service

- [ ] K-05: Add auth middleware on all delivery routes — delevery-service — require a verifiable user-service JWT on `POST /`, `GET /`, `GET /unassigned`, `GET /assigned/:driverId`, `GET /driver/:driverId*`, `DELETE /:id`; this is the root on which K-06/K-07 depend.
- [ ] K-06: Kill the IDOR — delevery-service — derive `driverId` from the verified JWT subject rather than `req.params`, and authorize customer reads to the caller's own orders only. Depends on K-05.
- [ ] K-07: Prevent mass assignment — delevery-service — whitelist the input fields for `createDelivery`; let the server own `assignedTo`/`deliveryStatus`/`earnings`/`deliveredAt` and drive them through workflow transitions only. Depends on K-05.
- [ ] K-08: Stop leaking raw errors — delevery-service — log the exception server-side and return a generic message instead of the `error` object. Independent of the auth work.
- [ ] Deps (delevery-service): upgrade `express` (≥4.22.x), `mongoose` (≥8.24 for `1118997`/`1139504`), plus transitive `path-to-regexp`, `qs`, `body-parser`, `brace-expansion`, `minimatch`, `picomatch`, `diff`.

## admin-service

- [ ] K-01: Authorize the email endpoint — admin-service — add an auth middleware that requires a verified user-service JWT with role `admin` on `POST /api/email/send-admin-invite`; start rejecting anonymous callers (the V-04-class bug). This is the foundation for CORS and validation hardening on this route.
- [ ] K-03: Restrict CORS — admin-service — replace the open `app.use(cors())` with an allowlist of the admin-dashboard origins. Depends on K-01 (so CORS and auth apply to the same protected surface).
- [ ] K-04: Validate + rate-limit the invite path — admin-service — enforce `email`/`name`/`password` schema checks and add per-IP/per-recipient rate limiting and an outgoing-mail queue. Depends on K-01.
- [ ] Deps (admin-service): upgrade `nodemailer` (→10.x per audit), `mongoose` (≥8.24), and review `axios`/`form-data`/`jws`/`minimatch`/`brace-expansion`/`path-to-regexp` transitive findings (via `twilio`).

## Suggested verification sequence after fixes
1. Re-run `npm audit` and confirm the high/critical advisories above clear.
2. Postman: (a) no token, (b) foreign-role token against each route in K-01/K-05/K-10/K-12 — expect 401/403.
3. Socket replay: unauthenticated client must fail to join `order_<id>` and `admin_monitoring`.