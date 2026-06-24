# VeloManage — Security Architecture

| Field | Value |
|---|---|
| Document version | 1.0 |
| Status | Phase 1 baseline + Phase 2-4 roadmap |
| Owner | Security, VeloManage |
| Related files | `backend/src/middleware/{auth,rbac,tenant,upload,errorHandler}.js`, `backend/src/models/{User,AuditLog,Organization}.js`, `backend/src/config/rbac.js`, `backend/server.js` |

---

## 1. OWASP Top 10 (2021) Compliance Map

| # | Vulnerability | VeloManage mitigation |
|---|---|---|
| A01 | Broken Access Control | RBAC middleware (`requirePermission`, `requireRole`); tenant isolation via `attachTenant` + `tenantFilter`; `validateTenantOwnership` per-route; refresh-token family revocation. |
| A02 | Cryptographic Failures | TLS 1.3 in transit; AES-256 at rest (MongoDB + S3); bcrypt cost 12 for passwords; SHA-256 hash for refresh tokens; field-level encryption for PII (`nationalId`, `licenseNumber`, `mfa.secret`). |
| A03 | Injection | Mongoose ODM with parameterized queries (no string concat); `express.json` parses strict JSON; never `eval`/`new Function`; no shell-out with user input. |
| A04 | Insecure Design | Threat-modeled per module; least-privilege RBAC; immutable audit log; rate limits; idempotency keys; security design review gate before launch. |
| A05 | Security Misconfiguration | Helmet headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy); strict CORS allowlist; non-root container user; secrets via K8s Secret; `.env` excluded from images. |
| A06 | Vulnerable & Outdated Components | `npm audit` in CI; Dependabot enabled; lockfile pinned; image base `node:20-alpine` (latest LTS); automated monthly patch PR. |
| A07 | Identification & Authentication Failures | JWT 15-min access + 30-day refresh with rotation; MFA TOTP; account lockout after 5 failed attempts; password history (last 5); breach checking via HaveIBeenPwned (planned). |
| A08 | Software and Data Integrity Failures | Lockfile pinned and verified in CI; image signatures via cosign (planned Phase 4); SBOM generated with `cyclonedx`; subresource integrity on web assets. |
| A09 | Security Logging & Monitoring Failures | Immutable audit log on every privileged mutation; Prometheus metrics; structured JSON logs; OpenTelemetry tracing (Phase 3); Alertmanager rules for security events. |
| A10 | Server-Side Request Forgery (SSRF) | No user-controlled outbound HTTP; webhook delivery uses an allowlist of URL schemes (https only); private IP ranges blocked on outbound. |

---

## 2. Authentication

### 2.1 Password storage
- Algorithm: bcrypt with cost factor 12 (`backend/src/models/User.js:197`).
- Minimum length: 8 characters (`User.password.minlength`).
- Password history: last 5 hashes retained (`User.passwordHistory`); reuse
  rejected by `/api/v1/auth/change-password`.
- Password expiry: 90 days by default (`Organization.settings.passwordPolicy.
  passwordExpiryDays`); configurable per org.
- Password change on first login: enforced for users provisioned by an
  admin (planned Phase 2).
- Breach checking: when a user registers or changes password, the SHA-1
  prefix (k-anonymity) is queried against HaveIBeenPwned; rejected if found
  (planned Phase 2).

### 2.2 JWT access tokens
- Algorithm: HS256 (planned migration to RS256 in Phase 4 with separate
  key pair for signing vs verification).
- TTL: 15 minutes (`JWT_ACCESS_EXPIRES_IN`).
- Payload: `{ userId, role, organizationId, iat, exp }`.
- Verification: `jwt.verify(token, JWT_SECRET)` in `authenticateToken`
  middleware; rejected on `JsonWebTokenError` (401) or `TokenExpiredError`
  (401).
- The user document is reloaded from MongoDB on every request so role
  changes / suspensions take effect immediately.

### 2.3 Refresh tokens
- Algorithm: HS256.
- TTL: 30 days (`JWT_REFRESH_EXPIRES_IN`).
- Storage: only the SHA-256 hash is stored on the user document
  (`User.refreshTokens[].tokenHash`); the raw token is returned to the
  client only at issuance.
- Rotation: `/api/v1/auth/refresh` issues a new access + refresh token and
  revokes the presented refresh token. The new refresh token carries the
  same `family` claim.
- Reuse detection: if a revoked refresh token is presented again, the
  entire family is revoked (`User.revokeRefreshTokenFamily`) — assumes
  token theft.
- Concurrent session cap: 10 (FIFO eviction).

### 2.4 MFA (TOTP)
- Default method: TOTP (RFC 6238) via `otplib` (planned Phase 2).
- `User.mfa.secret` is encrypted at rest and `select: false`.
- Backup codes: 10 single-use codes generated at enrollment, hashed
  with bcrypt, stored in `User.mfa.backupCodes` (`select: false`).
- Login flow when MFA is enabled returns
  `{ mfaRequired: true, mfaToken: <short-lived 5 min> }`; client
  completes with `POST /api/v1/auth/mfa/challenge`.

### 2.5 OAuth
- Providers: Google, Microsoft (Phase 4).
- On first login, a User is created with `oauth.google.id` or
  `oauth.microsoft.id` set; no password is generated.
- Account linking: an authenticated user may link a Google/Microsoft
  identity via `POST /api/v1/auth/oauth/link`.

### 2.6 SSO / SAML
- SP-initiated and IdP-initiated flows (Phase 4).
- SAML attributes mapped to VeloManage fields: `email`, `name`, `role`
  (optional), `groups` (mapped to VeloManage roles via a per-org mapping
  table).
- Certificate rotation: 30-day expiry alert; admin uploads new IdP cert.

---

## 3. Authorization

### 3.1 RBAC model
- 16 roles defined in `backend/src/config/rbac.js:16`.
- Permissions named `<module>:<action>[:<scope>]`; full matrix in
  `ROLE_PERMISSIONS` (`backend/src/config/rbac.js:37`).
- The matrix is the single source of truth — no route handler hard-codes
  role checks; all authorization goes through the RBAC middleware.

### 3.2 Permission matrix (excerpt)
| Permission | super_admin | company_owner | fleet_manager | driver | mechanic | finance_officer | auditor |
|---|---|---|---|---|---|---|---|
| `vehicles:read` | Y | Y | Y | Y | Y | N | N |
| `vehicles:write` | Y | Y | Y | N | N | N | N |
| `vehicles:delete` | Y | Y | N | N | N | N | N |
| `maintenance:approve` | Y | Y | Y | N | N | N | N |
| `finance:approve` | Y | Y | N | N | N | Y | N |
| `audit:read` | Y | Y | N | N | N | N | Y |
| `compliance:write` | Y | Y | N | N | N | N | N (compliance_officer only) |

(Full matrix in `backend/src/config/rbac.js`.)

### 3.3 Middleware chain
```
authenticateToken       → req.user
attachTenant            → req.tenant, req.tenantId
requirePermission(p)    → 403 if !roleHasPermission(role, p)
requireRole(r)          → 403 if role !== r
requireAnyPermission    → 403 if none match
requireAllPermissions   → 403 if any missing
validateTenantOwnership → 403 if doc.organizationId !== req.tenantId
```

### 3.4 Tenant isolation
- Every domain document carries `organizationId`.
- `tenantFilter(req)` returns `{ organizationId: req.tenantId }` for
  tenant users and `{}` for platform admins.
- Platform admins (`super_admin`, `platform_owner`) bypass the filter for
  cross-tenant operations; they may optionally scope to a single tenant
  via the `x-organization-id` header.
- `validateTenantOwnership` per-route guard prevents cross-tenant access
  by ID guessing (returns 404, not 403, to avoid leaking existence).

---

## 4. Session Management

### 4.1 Refresh token family
- A new family is created on each login (`User.generateRefreshToken`).
- Refresh tokens within a family chain via `family` claim.
- Family revocation rules:
  - logout → revoke the specific refresh token
  - logout-all → revoke all refresh tokens for the user
  - reuse detected → revoke entire family
  - password change → revoke all refresh tokens
  - admin suspends user → revoke all refresh tokens
  - MFA enabled/disabled → revoke all refresh tokens

### 4.2 Device tracking
Each `refreshToken` sub-document records:
- `deviceName`, `deviceType` (web/ios/android/api/desktop/other)
- `userAgent`
- `ipAddress`
- `lastUsedAt`
- `expiresAt`
- `revokedAt`, `revokedReason`

`GET /api/v1/auth/sessions` exposes this so the user can audit active
sessions and revoke unrecognized ones.

### 4.3 Session timeouts
- Access token: 15 min (hard).
- Refresh token: 30 days (sliding — refresh resets the clock).
- Idle session timeout: 60 min
  (`Organization.settings.sessionTimeoutMinutes`); enforced client-side
  via activity tracking.
- Platform admins: 30-min idle timeout (more strict).

---

## 5. Password Policy

Enforced at registration and password-change. Default values are tunable
per organization via `Organization.settings.passwordPolicy`.

| Rule | Default |
|---|---|
| Minimum length | 8 characters |
| Require uppercase | yes |
| Require lowercase | yes |
| Require numbers | yes |
| Require symbols | no (configurable) |
| Maximum length | 128 characters (DoS protection) |
| Password expiry | 90 days |
| Password history | last 5 (no reuse) |
| Common-password check | top 10,000 list rejected (planned Phase 2) |
| Breach check | HaveIBeenPwned (planned Phase 2) |
| Lockout | 5 failures → 15-min lock |
| Lockout escalation | 3rd lockout in 24 h → 1-hour lock (planned) |

---

## 6. Rate Limiting

### 6.1 Limits
| Scope | Limit | Window | Enforcement |
|---|---|---|---|
| Global per IP | 100 req | 15 min | `express-rate-limit`, in-process (Phase 1), Redis (Phase 2) |
| Auth routes (`/auth/login`, `/auth/refresh`) | 10 req | 10 min per IP+email | per-route limiter |
| Password reset | 3 req | 1 hour per email | per-route limiter |
| Write endpoints | 60 req | 1 min per user | per-user limiter (Phase 2) |
| Export endpoints | 5 req | 1 hour per user | per-user limiter |
| Real-time GPS push | 1 req | 1 s per device | per-connection limiter (Phase 2) |

### 6.2 Response on limit exceeded
- HTTP 429.
- Headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`
  (RFC drafts), `Retry-After`.
- Body: `{ success: false, error: "Too many requests from this IP, please try again later." }`

### 6.3 Evasion defenses
- `app.set('trust proxy', 1)` so the real client IP is read from
  `X-Forwarded-For` (Render / NGINX Ingress).
- Per-user limit (Phase 2) prevents IP rotation attacks.
- Suspicious pattern detection (1000 req/min from one IP across many
  user accounts) triggers a temporary IP block + alert.

---

## 7. IP Allowlisting

- Per-organization IP allowlist: `Organization.settings.ipWhitelist[]`.
- Enforced by middleware (`ipAllowlist`) that runs after `attachTenant`
  and rejects requests from IPs not in the list (403).
- CIDR support (e.g. `203.0.113.0/24`) for corporate networks.
- Bypassed for platform admins (so VeloManage support can always access).
- Empty allowlist = no restriction (default).

---

## 8. Audit Logging

### 8.1 What is logged
Every privileged mutation creates an `AuditLog` entry via
`recordAudit()` (`backend/src/models/AuditLog.js:108`). The entry
captures:

- **Who**: `userId`, `userRole`, `userEmail`
- **Where**: `organizationId`, `ipAddress`, `userAgent`, `geo`
- **What**: `action` (e.g. `vehicle.create`), `category`, `severity`
  (info / warning / critical)
- **Target**: `resourceType`, `resourceId`, `resourceName`
- **Result**: `status` (success / failure / denied), `statusCode`
- **Context**: `method`, `path`, `requestBody` (sanitized),
  `responseSummary`, `before`, `after` (changeset)
- **Correlation**: `traceId`, `sessionId`

### 8.2 Sensitive field redaction
`sanitizeForLog(obj)` (`backend/src/models/AuditLog.js:91`) recursively
redacts any key whose name contains (case-insensitive) `password`,
`newPassword`, `confirmPassword`, `token`, `refreshToken`, `secret`,
`apiKey`, `cardNumber`, `cvv`, `authorization`.

### 8.3 Retention
- TTL index on `AuditLog.timestamp`: 7 years (2555 days).
- After 7 years, records are auto-deleted by MongoDB's TTL monitor.
- For organizations requiring longer retention, a partial-filter TTL
  index per-tenant is planned Phase 4.

### 8.4 Immutability
- The `AuditLog` collection has no `updatedAt` field (timestamp-only).
- No `update` or `delete` endpoints exist on `/api/v1/audit`.
- Database user used by the API has `insert` + `find` permissions only
  on `auditlogs` (enforced via MongoDB roles — Phase 4 hardening).
- Cold storage: records > 90 days moved to S3-backed queryable archive
  (Atlas Online Archive) — read-only, slower latency.

### 8.5 Review
- `GET /api/v1/audit?filter=...` returns paginated audit entries
  (`audit:read` permission required).
- `GET /api/v1/audit/export` returns CSV/JSON for compliance evidence
  (`audit:read` + `reports:export`).

---

## 9. Encryption

### 9.1 In transit
- TLS 1.3 enforced (TLS 1.2 deprecated, scheduled for removal Phase 4).
- HSTS header: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- Certificate: Let's Encrypt via cert-manager in K8s; auto-renewed.
- MongoDB connection: `mongodb+srv://` with TLS required.
- Redis connection: TLS for managed Redis (Elasticache / Redis Cloud).

### 9.2 At rest
- MongoDB: AES-256 via Atlas-managed encryption (or customer-managed
  keys via AWS KMS in Phase 4).
- Redis: encrypted at rest (provider-managed).
- S3 / object storage: SSE-S3 by default; SSE-KMS for sensitive buckets
  (Phase 4).
- EBS volumes: encrypted (K8s provider default).

### 9.3 Field-level encryption
PII fields are individually encrypted at the application layer (Phase 2
implementation; Phase 1 schema reserves the fields with `select: false`):

| Field | Encryption |
|---|---|
| `User.password` | bcrypt (one-way hash, cost 12) |
| `User.refreshTokens[].tokenHash` | SHA-256 (one-way hash) |
| `User.mfa.secret` | AES-256-GCM with `MFA_ENCRYPTION_KEY` |
| `User.mfa.backupCodes[]` | bcrypt |
| `User.profile.nationalId` | AES-256-GCM |
| `User.driverProfile.licenseNumber` | AES-256-GCM |
| `FuelCard.cardNumber` | AES-256-GCM (tokenized; last 4 stored) |

---

## 10. Input Validation

- Every route uses `express-validator` chains (planned Phase 2;
  Phase 1 uses Mongoose schema validation as the primary defense).
- Mongoose schemas enforce type, enum, length, regex, and required-field
  constraints at the model layer — invalid input raises
  `ValidationError` → 400.
- Request body size limit: 10 MB (`backend/server.js:210`).
- JSON parser rejects duplicate keys and trailing commas.
- `express.json` strict mode rejects anything that is not a JSON object
  or array at the top level.

---

## 11. Output Encoding

- The backend is a JSON-only API; no HTML is rendered server-side.
- HTTP responses set `Content-Type: application/json; charset=utf-8`,
  which prevents the browser from interpreting JSON as HTML.
- No `eval`, `Function()`, `vm.runInNewContext` anywhere in the codebase
  (verified by lint rule — planned Phase 2).
- MongoDB queries use the Mongoose ODM (no string interpolation);
  aggregation pipelines use `$expr` with typed operators.
- Logs are written as JSON strings via `JSON.stringify`; user input is
  never concatenated into log templates.

---

## 12. CORS

- Allowlist-based: only origins in `FRONTEND_URL` + `ADDITIONAL_CORS_ORIGINS`
  are accepted.
- Origins are matched exactly (no wildcard in production); `localhost`
  origins are accepted only in development.
- Credentials allowed (`Access-Control-Allow-Credentials: true`).
- Methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
- Allowed headers: `Content-Type, Authorization, X-Requested-With,
  X-Organization-Id, Idempotency-Key`.
- Preflight cache: 1 hour (`Access-Control-Max-Age: 3600`).
- Per-tenant custom-domain routing planned Phase 4 — each organization's
  custom domain is added to the allowlist dynamically.

---

## 13. Helmet Security Headers

Configured via `app.use(helmet())` (`backend/server.js:179`). Defaults
applied:

| Header | Value |
|---|---|
| `Content-Security-Policy` | default-src 'self'; script-src 'self'; ... |
| `Cross-Origin-Opener-Policy` | same-origin |
| `Cross-Origin-Resource-Policy` | same-origin |
| `Cross-Origin-Embedder-Policy` | require-corp |
| `Origin-Agent-Cluster` | ?1 |
| `X-DNS-Prefetch-Control` | off |
| `X-Frame-Options` | SAMEORIGIN |
| `Strict-Transport-Security` | max-age=63072000; includeSubDomains; preload |
| `X-Download-Options` | noopen |
| `X-Content-Type-Options` | nosniff |
| `X-Permitted-Cross-Domain-Policies` | none |
| `Referrer-Policy` | no-referrer |
| `X-XSS-Protection` | 0 (disabled in favor of CSP) |

Phase 2 will tune the CSP for the React app's specific needs (nonce-based
script-src, no inline styles except via 'unsafe-inline' for styled-
components, etc.).

---

## 14. File Upload Security

- Multer middleware (`backend/src/middleware/upload.js`) enforces:
  - MIME type allowlist (jpeg, png, pdf, csv, xlsx, docx)
  - Maximum size (10 MB default; configurable per route)
  - Original filename sanitized (no path traversal, no null bytes)
- Phase 2 enhancements:
  - Magic-byte verification (not just MIME type from header)
  - ClamAV sidecar virus scan on every upload before persisting
  - Image re-encoding (strip EXIF, normalize size)
- Phase 4: presigned S3 URLs with short TTL (15 min) so the API never
  proxies large files.

---

## 15. GDPR Compliance

### 15.1 Lawful basis & consent tracking
- `User.consent` records:
  - `termsAcceptedAt`
  - `privacyAcceptedAt`
  - `marketingOptIn` (default false)
  - `dataProcessingConsent`
- Consent timestamps are immutable; withdrawal of consent is recorded as
  a separate audit event.

### 15.2 Right to be forgotten
- `POST /api/v1/users/:id/forget` (or self-service via `/api/v1/auth/forget-me`)
  sets `User.dataRetention.deleteAfter = now + 90 days`.
- A daily BullMQ job (Phase 2) anonymizes such users:
  - `name` → "Deleted User"
  - `email` → `deleted+<uuid>@velomanage.invalid`
  - `password` → random 32-char string
  - `profile`, `driverProfile`, `oauth` → null
  - `anonymizedAt` set
- Audit logs retain the original `userEmail` for accountability (GDPR
  Art. 17(3)(b) — retention for legal obligations).

### 15.3 Data export
- `POST /api/v1/users/:id/export` (or self-service via
  `/api/v1/auth/export-me`) initiates a BullMQ job that compiles a ZIP
  of all the user's data (profile, trips, fuel logs, work orders,
  finance transactions, audit log entries) and uploads it to S3 with
  a presigned URL valid for 7 days.

### 15.4 Data retention
- Default: 7 years (`Organization.settings.dataRetentionDays = 2555`).
- Configurable per org (longer for regulated industries).
- Beyond retention: auto-deletion via TTL indexes + archive workers.

### 15.5 Data Processing Addenda (DPA)
- Template DPA published at `docs/legal/DPA.md` (Phase 4).
- Sub-processor list (MongoDB Atlas, AWS, Stripe, etc.) maintained and
  notified to customers on change.

---

## 16. SOC2 Readiness

| Trust Service Criterion | Control | Status |
|---|---|---|
| CC1 (Control Environment) | Code of conduct, role-based access, segregation of duties | documented Phase 1 |
| CC2 (Communication) | Security policy published; incident response plan | this document + `ADMIN_MANUAL.md` |
| CC3 (Risk Assessment) | Annual risk assessment; threat modeling per feature | planned Phase 3 |
| CC4 (Monitoring) | Audit log, Prometheus, Alertmanager, quarterly access review | Phase 1 + Phase 3 |
| CC5 (Control Activities) | RBAC, change management, PR review required | Phase 1 |
| CC6 (Logical Access) | MFA, password policy, IP allowlist, session management | Phase 1 + Phase 2 (MFA) |
| CC7 (System Operations) | CI/CD, blue/green deploy, change ticket required | Phase 1 |
| CC8 (Change Management) | PR review, environment separation, rollback runbook | Phase 1 |
| CC9 (Risk Mitigation) | Business continuity plan, DR runbook | `ADMIN_MANUAL.md` |
| A1 (Availability) | 99.9 % uptime SLA, HPA, multi-AZ | Phase 1 |
| C1 (Confidentiality) | Encryption at rest/transit, field-level encryption | Phase 1 + Phase 2 |
| PI1 (Processing Integrity) | Idempotency keys, audit log, data validation | Phase 1 + Phase 2 |
| P1-P7 (Privacy) | GDPR compliance, consent, right to be forgotten | Phase 4 |

SOC2 Type II audit is scheduled for Phase 4 (months 13–18).

---

## 17. Incident Response Plan

### 17.1 Detection
- Automated: Alertmanager rules fire on:
  - `/health` returning 503 for > 60 s
  - error rate > 1 % over 5 min
  - audit log `severity: critical` entries
  - multiple 401/403 from one IP in 1 min (brute-force)
  - unusual login geo for `super_admin` / `platform_owner`
- Manual: customer report via `security@velomanage.example` (PGP key
  published).

### 17.2 Severity classification
| Severity | Definition | Response time |
|---|---|---|
| SEV-1 | Production outage or confirmed data breach | 15 min |
| SEV-2 | Major feature broken; security incident suspected | 1 hour |
| SEV-3 | Minor feature broken; no security impact | 4 hours |
| SEV-4 | Cosmetic / docs | next business day |

### 17.3 Containment
- Affected accounts suspended (`User.isSuspended = true`).
- Refresh tokens revoked for affected users.
- If a tenant is compromised: organization suspended, all sessions
  revoked, password reset forced on next login.
- If a pod is compromised: cordoned + drained; logs snapshotted.

### 17.4 Eradication
- Root cause identified; vulnerable code reverted or patched.
- All credentials rotated (JWT secret, DB password, S3 keys).
- Affected customers notified within 72 hours per GDPR Art. 33.

### 17.5 Recovery
- Services restored from last known-good deploy.
- Data restored from PITR if data loss occurred.
- Smoke tests + canary traffic before full recovery.

### 17.6 Lessons learned
- Post-mortem within 5 business days, published to
  `docs/incidents/<date>-<slug>.md`.
- Action items tracked to closure; similar controls audited.
- Tabletop exercise quarterly.

---

## 18. Vulnerability Disclosure Policy

- Email: `security@velomanage.example` (PGP key fingerprint published
  at `/security.txt`).
- Response SLA: 24 hours acknowledgement, 72 hours initial assessment,
  14 days fix or mitigation plan.
- Safe harbor: we will not pursue legal action against researchers who
  follow the policy (no DoS, no exfiltration of customer data, report
  first then disclose after 90 days or fix — whichever first).
- Bug bounty: planned Phase 4 via HackerOne.

---

## 19. Secrets Management

- Local development: `.env` files (gitignored); `.env.example` documents
  required variables.
- Production: Kubernetes Secrets (mounted as env vars or files); sealed
  secrets via Bitnami Sealed Secrets (Phase 2) for gitops.
- Rotation: every 90 days for DB passwords and JWT secrets; on personnel
  change for admin credentials.
- Audit: secret access logged via Kubernetes audit log.

---

## 20. Open Security Items (Phase 2-4)

- MFA enrollment flow (TOTP) — Phase 2
- Field-level encryption implementation (Phase 2)
- Breach-checking service integration (Phase 2)
- RS256 JWT signing with key pair (Phase 4)
- cosign image signing in CI (Phase 4)
- ClamAV sidecar for file uploads (Phase 2)
- Per-tenant custom-domain CORS allowlist (Phase 4)
- SOC2 Type II audit (Phase 4)
- Bug bounty program (Phase 4)
- Penetration test (annual, starting Phase 4)
