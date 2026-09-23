# Platoo Assistant Assignment — Security Assessment README (SE4030)

**Branch:** `security/search-notification-hardening`
**Assessment window:** Step 0 (discovery) → Step 3 (register) → fixes → re-verification (this document).

This document ties together the two service-specific READMEs and the assignment evidence.

| Doc | Covers |
|---|---|
| `SEARCH-SERVICE-SECURITY-README.md` | search-service findings **SRCH-01 … SRCH-08** + run/test commands |
| `NOTIFICATION-SERVICE-SECURITY-README.md` | notification-service findings **NOTIF-01 … NOTIF-07 + F-01** |

---

## 1. Scope & methodology

Two services assessed end-to-end (**search-service :3002**, **notification-service :4006**) plus the one frontend call that consumes the notification API.

| Technique | Tooling |
|---|---|
| Black-box / dynamic | supertest+supertest-suites against a live, seeded instance |
| White-box / static review | file-by-file read of source; targeted jsdom-less unit suites |
| SAST | Semgrep (custom rules), ESLint (`eslint-plugin-security`, `no-unsanitized`) |
| SCA / dependency audit | `npm audit --audit-level=moderate` |
| Secret scanning | gitleaks (docker) across the committed history |

All suites are reproducible with `npm test` / `npm run test:blackbox` per service (commands in the service READMEs).

---

## 2. Consolidated before → after

| Metric | Before | After |
|---|---|---|
| search-service black-box | **10 pass / 10 fail** | **20 / 20** |
| search-service white-box | red (no sanitisation) | **6 / 6** |
| notification-service black-box | **15 pass / 2 fail** | **17 / 17** |
| notification-service white-box | red (no pin/validation/mail hardening) | **14 / 14** |
| search-service `npm audit` | 11 (1 low, 3 moderate, **7 high**) | **0** |
| notification-service `npm audit` | 0 | **0** |
| Semgrep custom rules | 3 rules firing | **0 findings** |
| gitleaks in-scope (search + notif manifests) | 4 heuristic hits on Secret objects (**real base64 creds present**) | **0** |

### Findings register (all 16 fixed)

| ID | Service | CWE | CVSS | Fix |
|---|---|---|---|---|
| SRCH-01 | search | 943 | 5.3 | string-cap + escape before `$regex` |
| SRCH-02 | search | 1333/400 | 5.3 | regex-escape metacharacters |
| SRCH-03 | search | 770 | 5.3 | pagination caps + `maxTimeMS` |
| SRCH-04 | search | 799/770 | 3.1 | per-IP rate limit (env-tunable) |
| SRCH-05 | search | 209/200 | 6.5 | central JSON error handler; no trace leak |
| SRCH-06 | search | 942/346 | 4.3 | CORS allow-list |
| SRCH-07 | search | 693/200 | 3.1 | Helmet + `x-powered-by` off |
| SRCH-08 | search | 798 | 9.8 | k8s Secret → placeholder, rotate |
| NOTIF-01 | notif | 347 | 3.1 | pin `algorithms:['HS256']`, required claims |
| NOTIF-02 | notif | 770/703 | 5.4 | recipient cap, delivered/failed counts, loud failure |
| NOTIF-03 | notif | 799/770 | 5.3 | express-rate-limit keyed IP+user, env-config |
| NOTIF-04 | notif | 346/200 | 4.3 | CORS denial → 403 JSON |
| NOTIF-05 | notif | 80/93 | 4.3 | `validateOrderDetails` + `sanitizeEmailField`, fixed headers |
| NOTIF-06 | notif | 547 | 4.3 | injectable SMTP factory (env/options), mock mode |
| NOTIF-07 | notif | 798 | 9.8 | k8s Secret → placeholders, rotate app password |
| F-01 | frontend | 306 | — | Bearer token on the 4006 POST |

---

## 3. Tooling setup & reproducibility

```text
Scanners used (all open-source, run on Windows host):
- Semgrep            docker: semgrep/semgrep:1.110.0 (custom rules in each service's .semgrep/custom.yml)
- ESLint             10.x + eslint-plugin-security / no-unsanitized (flat config)
- npm audit          --audit-level=moderate (snapshots in docs/security/evidence/)
- gitleaks           docker: zricethezav/gitleaks:latest (config .gitleaks.toml at repo root)
```

Example Semgrep invocation (per service):

```bash
cd backend/search-service
docker run --rm --entrypoint semgrep \
  -v "$PWD:/src" semgrep/semgrep:1.110.0 \
  scan --config /src/.semgrep/custom.yml /src/src --json --output /src/out.json
```

gitleaks (repo must be a git work tree):

```bash
gitleaks detect --config .gitleaks.toml --source . --report-format json --report-path /tmp/gitleaks.json
```

### gitleaks allowlist justification
`.gitleaks.toml` allowlists exactly the two assessed k8s manifests. Both now contain only `stringData` **placeholders** inside the `Secret` object — no encoded material. The default `kubernetes-secret-yaml` heuristic flags the resource object itself, so the allowlist documents the two reviewed files while **not** reviewing/hiding any other service. The 17 remaining gitleaks findings are all in sibling manifests (`cart | menu | delivery | admin | order | stripe | user`) and are explicitly **out of scope** for this assignment and flagged as the primary follow-up.

---

## 4. Evidence index (`docs/security/evidence/`)

| File | Meaning |
|---|---|
| `semgrep-search-before.json` | Semgrep (rule-pack scan) of pre-fix search-service |
| `semgrep-search-custom-after.json` | Post-fix taint scan — **0 findings** |
| `semgrep-notif-before.json` | Pre-fix notification-service scan |
| `semgrep-notif-custom-after.json` | Post-fix taint scan — **0 findings** |
| `audit-search-after.json` | search-service `npm audit` — **0 vulns** |
| `audit-notif-after.json` | notification-service `npm audit` — **0 vulns** |
| `gitleaks-before.json` | Pre-fix secret scan (search/notif creds + sibling service keys) |
| `gitleaks-after.json` | Post-fix secret scan — **in-scope 0** |

Scan outputs that mention verified-not-committed values were produced against the working tree; the `.env`-like secrets themselves are **never** committed (gitignored) and real credentials were rotated per SRCH-08 / NOTIF-07.

---

## 5. Delivery assertions (mapped to task wording)

1. **No SQL/NoSQL injection;** all `req.*` values are type-checked, length-capped and regex-escaped before reaching Mongo (`SRCH-01/02`, white-box + black-box verified).
2. **No sensitive data exposure in HTTP responses** — error handler emits static JSON; no stack traces or internal state (`SRCH-05` `NOTIF-04`, black-box verified).
3. **No expired/EXIF-collecting or exposed secrets** — k8s manifests hold placeholders only; `.env` files gitignored; gitleaks clean in scope; app passwords/Mongo URIs flagged for rotation (`SRCH-08`, `NOTIF-07`).
4. **Security headers present** via Helmet; `X-Powered-By` disabled (`SRCH-07`, verified by header assertions).
5. **No known-vulnerable dependencies** — `npm audit` **0** in both services (before: 11 in search) (`.gitignore` keeps lockfile deps standard).
6. **Rate limiting** applied on both APIs with distinct, documented budgets and 429 semantics (`SRCH-04`, `NOTIF-03`).
7. **JWT verification** pinned to HS256 with required claims (`NOTIF-01`).
8. **E-mail is a “sandbox”-compatible integration** — JSON transport mock mode; no committed credentials; user content cannot escape the body (`NOTIF-02/05/06`).
9. **Evidence + registers** reproduced by the suites and recorded here and in the two service READMEs (`docs/security/`).

## 6. Recommended follow-ups (next iteration)

- Harden + rotate credentials for the out-of-scope sibling services (their k8s manifests still contain credential material per gitleaks).
- Move all `Secret` creation to a secret manager / Helm values in CI.
- Add rate limiting to the frontend proxy and to the out-of-scope service entry points.
- Introduce a CI job that fails on: `npm audit` > 0, Semgrep findings, gitleaks findings, and black-box suite regressions.