# VeloManage — System Architecture

| Field | Value |
|---|---|
| Document version | 1.0 |
| Status | Phase 1 baseline |
| Owner | Architecture, VeloManage |
| Related files | `backend/server.js`, `backend/src/middleware/*`, `backend/src/config/rbac.js`, `k8s/*`, `docker-compose.yml` |

---

## 1. High-Level Architecture

VeloManage is a containerized multi-tier web platform: a React/Vite SPA, a
Node.js/Express REST API, MongoDB as the system-of-record, Redis as cache
and BullMQ broker, Socket.io for real-time push, and a future React Native
mobile client and AI/ML inference layer. The deployment target is Kubernetes
with horizontal pod autoscaling; a single-VM Render deployment is supported
for early customers and staging.

```
                    ┌────────────────────────────────────────────┐
                    │                  Clients                    │
                    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
                    │  │  Web SPA │  │ Mobile   │  │ 3rd-party│  │
                    │  │ React/Vite│ │ React    │  │ via SDK  │  │
                    │  └─────┬────┘  └─────┬────┘  └────┬─────┘  │
                    └───────┼─────────────┼────────────┼────────┘
                            │ HTTPS/TLS   │ HTTPS/WSS  │ HTTPS
                            ▼             ▼            ▼
                    ┌────────────────────────────────────────────┐
                    │           Ingress (NGINX / Ingress-NGINX)  │
                    │      TLS termination, path routing, WAF    │
                    └───────┬─────────────┬────────────┬─────────┘
                            │ /api/*       │ /socket.io │ /metrics
                            ▼             ▼            ▼
                    ┌────────────────────────────────────────────┐
                    │              API tier (Express)             │
                    │  ┌────────────────────────────────────────┐ │
                    │  │ Helmet · CORS · Rate-limit · Metrics   │ │
                    │  ├────────────────────────────────────────┤ │
                    │  │ AuthN (JWT) · Tenant attach · RBAC     │ │
                    │  ├────────────────────────────────────────┤ │
                    │  │ 13 module routers + legacy routers     │ │
                    │  └────────────────────────────────────────┘ │
                    │  HPA: 3–20 replicas · PDB: minAvailable 2   │
                    └──┬───────────────┬──────────────┬───────────┘
                       │               │              │
                       ▼               ▼              ▼
              ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
              │  MongoDB     │ │   Redis      │ │  Socket.io   │
              │  (Atlas)     │ │  cache+queue │ │  rooms/tenant│
              │  shard:      │ │              │ │              │
              │  organization│ │              │ │              │
              └──────────────┘ └──────┬───────┘ └──────────────┘
                                      │
                                      ▼
                              ┌──────────────┐
                              │  BullMQ      │
                              │  workers     │
                              │  notif/reports│
                              │  AI inference│
                              └──────────────┘

                       ┌──────────────────────────┐
                       │  Observability           │
                       │  Prometheus · Grafana    │
                       │  Loki · OpenTelemetry    │
                       └──────────────────────────┘
```

---

## 2. Component Breakdown

### 2.1 Frontend (React + Vite)
- Directory: `frontend/`
- Build: Vite + Tailwind; static files served by NGINX in production.
- Routing/state: React Router, Context API (`AuthContext`, `SocketContext`,
  `ServiceContext`, `MessageContext`).
- API client: `frontend/src/services/api.js` (Axios wrapper).
- UI primitives: `frontend/src/components/ui/*` (shadcn-style primitives).
- Container: multi-stage Dockerfile (`frontend/Dockerfile`) → `nginx:alpine`.

### 2.2 Backend (Node.js + Express)
- Directory: `backend/`
- Entry: `backend/server.js` — wires middleware, routes, Socket.io, health,
  metrics, graceful shutdown.
- Routes:
  - `backend/src/routes/auth.js` — register, login, refresh, verify,
    logout, sessions, change-password, password-reset/request.
  - `backend/src/routes/modules/*.js` — 13 module routers built on
    `createCrudRouter` (`backend/src/routes/crudFactory.js`) + custom
    business endpoints.
  - `backend/src/routes/{users,organizations,audit,services,trucks,
    messages,pickups,branches,bookings,analytics,dashboard,locations,
    payments}.js` — legacy routes preserved for backward compatibility.
- Models: `backend/src/models/*.js` (26 files; see `DATABASE_DESIGN.md`).
- Middleware:
  - `auth.js` — `authenticateToken`, `requireAdmin`, `requireOwnershipOrAdmin`,
    `optionalAuth`.
  - `tenant.js` — `attachTenant`, `tenantFilter`, `requireTenant`,
    `validateTenantOwnership`.
  - `rbac.js` — `requirePermission`, `requireRole`,
    `requireAnyPermission`, `requireAllPermissions`.
  - `errorHandler.js` — centralized JSON error envelope.
  - `monitoring.js` — Prometheus metrics (zero-dependency).
  - `upload.js` — multer file upload.
  - `duplicateEmailCheck.js` — register-time guard.

### 2.3 Database (MongoDB)
- MongoDB Atlas in production; community edition in `docker-compose.yml`.
- Connection: `mongoose.connect()` with retryWrites, retryReads, maxPoolSize 10,
  serverSelectionTimeoutMS 30000, exponential backoff on connect failure.
- See `DATABASE_DESIGN.md` for schema, indexes, sharding, backup.

### 2.4 Cache (Redis)
- Used for:
  - Session hot-path cache (user object + permissions) keyed by
    `userId` + `tokenHash` (TTL 5 min).
  - Rate-limit counters (distributed rate limit once we add Redis store).
  - BullMQ queues.
  - Hot list data (organization limits, branch lookup).
- Wired into Node via `ioredis` (planned in Phase 2 alongside BullMQ);
  Phase 1 uses in-process rate limit and in-memory Mongoose caches.

### 2.5 Real-time (Socket.io)
- Server: `backend/server.js:333-384` — one `Server` attached to the same
  HTTP server, exposed at `/socket.io/`.
- Auth: token validated on connection; clients join `user-<id>` or
  `admin-room` rooms.
- Events (current): `truck-location-update`, `new-message`,
  `new-pickup-request`, `truck-dispatched`.
- Phase 2 expansion: per-tenant rooms (`tenant-<orgId>`), `gps.update`,
  `geofence.enter`, `geofence.exit`, `workorder.assigned`,
  `alert.critical`.

### 2.6 Mobile (React Native) — Phase 2
- Offline-first with sync engine; biometric auth; background GPS; push
  notifications; QR/barcode scanning. See `PRD.md` §8.

### 2.7 AI/ML services — Phase 3
- Separate Python service exposing `/predict` endpoints; called by BullMQ
  workers. Models: LSTM (maintenance), Isolation Forest (fuel anomaly),
  XGBoost (driver score), Prophet (demand), OR-Tools (scheduling),
  LLM-RAG (assistant). See `ROADMAP.md` Phase 3.

---

## 3. Multi-Tenant Architecture

VeloManage implements **row-level multi-tenancy** on a shared database. Every
domain document carries `organizationId: ObjectId`. Isolation is enforced by
middleware, not by application code in each handler.

### Tenant resolution chain
```
HTTP request → authenticateToken (sets req.user)
             → attachTenant (sets req.tenant, req.tenantId)
             → RBAC middleware (requirePermission/requireRole)
             → route handler spreads req.tenantFilter() into every query
```

- `attachTenant` (`backend/src/middleware/tenant.js:18`) resolves the
  caller's organization from `req.user.organizationId` or, for platform
  admins, from the `x-organization-id` header. It rejects with 403 if the
  resolved organization is suspended.
- `tenantFilter(req)` (`backend/src/middleware/tenant.js:58`) returns
  `{ organizationId: req.tenantId }` for normal users and `{}` for platform
  admins acting cross-tenant.
- `requireTenant` rejects requests with no tenant context if the caller is
  not a platform admin.
- `validateTenantOwnership(model, source, key)` (`backend/src/middleware/tenant.js:90`)
  is a per-route guard that loads the target document and verifies
  `doc.organizationId === req.tenantId`; returns 403 on cross-tenant access.
- `Organization` is the root entity (`backend/src/models/Organization.js`)
  carrying plan, limits, branding, password policy, IP allowlist, and data
  retention. Limits (`maxUsers`, `maxVehicles`, `maxBranches`,
  `maxStorageMb`) are enforced by the model's `isWithinLimits()` helper.

### Hierarchy
- `Organization.parentId` enables holding-company / subsidiary structures.
- `Branch` is the next level down; many documents carry `branchId` for
  finer-grained reporting and `branch_manager` role scoping.
- `User.branchId` enables branch-scoped role grants.

---

## 4. RBAC Architecture

### 16 roles
Defined in `backend/src/config/rbac.js`:

| Tier | Roles |
|---|---|
| Platform | `super_admin`, `platform_owner` |
| Tenant admin | `company_owner`, `regional_manager`, `fleet_manager`, `operations_manager`, `branch_manager` |
| Operational | `driver`, `mechanic`, `dispatcher`, `customer_support` |
| Specialist | `finance_officer`, `hr_officer`, `compliance_officer`, `auditor` |
| Other | `read_only_user` |

### Permission naming
Convention: `<module>:<action>[:<scope>]`. Examples: `vehicles:read`,
`vehicles:write`, `vehicles:delete`, `maintenance:approve`, `fleet:read:all`.

### Permission matrix
Stored in `ROLE_PERMISSIONS` (`backend/src/config/rbac.js:37`). The matrix
is the single source of truth — `requirePermission('...')` looks up
`roleHasPermission(role, permission)` which supports:
- exact match (`'vehicles:write'`)
- module wildcard (`'vehicles:*'`)
- global wildcard (`'*'` for `super_admin`, `platform_owner`)

### Middleware chain
```
requirePermission(p)            // single permission
requireAnyPermission([p1,p2])   // any of
requireAllPermissions([p1,p2])  // all of
requireRole(r)                  // exact role
```
All middlewares return 401 if `req.user` is missing and 403 if the
permission/role check fails. `super_admin` and `platform_owner` bypass all
RBAC checks via the global wildcard.

### Levels
`ROLE_LEVELS` provides a numeric rank (0 = platform, 99 = read_only) used by
the UI to show reporting hierarchies and by some route handlers to validate
"can manage user X" rules.

---

## 5. Authentication Flow

### Tokens
- **Access token**: JWT signed with `JWT_SECRET`, TTL 15 minutes
  (`JWT_ACCESS_EXPIRES_IN`), payload `{ userId, role, organizationId }`.
- **Refresh token**: JWT signed with `JWT_REFRESH_SECRET` (or fallback to
  `JWT_SECRET`), TTL 30 days (`JWT_REFRESH_EXPIRES_IN`), payload
  `{ userId, family, type: 'refresh' }`. **Only the SHA-256 hash is stored**
  on the `User.refreshTokens` sub-document (`backend/src/models/User.js:242`).

### Rotation
- Each login creates a new **family** (`family = ObjectId().toString()`).
- `/api/v1/auth/refresh` issues a new access token + a new refresh token
  **in the same family** and revokes the old refresh token.
- If a revoked refresh token is replayed, the entire family is revoked
  (`revokeRefreshTokenFamily`) — this is the standard refresh-token-rotation
  reuse-detection pattern that defeats token theft.

### Concurrent sessions
- Capped at 10 active refresh tokens per user (FIFO eviction).
- `/api/v1/auth/sessions` lists them; `/api/v1/auth/logout` revokes one;
  `/api/v1/auth/logout-all` revokes all.

### MFA
- TOTP-based; `User.mfa.secret` (encrypted at rest, `select: false`),
  `backupCodes` (also `select: false`).
- Scaffolding is in place in Phase 1; full TOTP enrollment flow ships in
  Phase 2 alongside the mobile app.

### OAuth / SSO
- `User.oauth.google`, `User.oauth.microsoft`, `User.oauth.saml` fields
  exist; integration with Google/Microsoft OAuth providers and SAML IdPs
  is scheduled for Phase 4 (enterprise tier).

### Login lockout
- After 5 consecutive failed logins, `lockedUntil = now + 15 min`
  (`User.recordLoginAttempt`, `backend/src/models/User.js:300`).
- Login history capped at 50 entries.

---

## 6. Data Architecture

See `DATABASE_DESIGN.md` for the full treatment. Key points:

- **Engine**: MongoDB 6.0+ (Atlas recommended).
- **Shard key**: `{ organizationId: 1, _id: 1 }` once a collection exceeds
  10 M documents; enabled collection-by-collection starting in Phase 4.
- **Index strategy**: every collection carries a compound index on
  `{ organizationId: 1, <natural-sort-key>: 1 }` so paginated list queries
  hit the index directly.
- **TTL indexes**: `AuditLog.timestamp` TTL = 7 years (2555 days × 86400 s).
- **Soft deletes**: most domain documents have `isActive: Boolean`; DELETE
  routes flip `isActive=false` rather than removing the document.

---

## 7. API Architecture

- REST over HTTPS, base URL `/api/v1`.
- Versioned by URL path; a future `/api/v2` namespace will be added for
  breaking changes (see `API_DESIGN.md` §Versioning).
- OpenAPI/Swagger auto-generated from JSDoc annotations — planned Phase 4.
- GraphQL gateway in front of REST — planned Phase 4.
- All responses use the JSON envelope `{ success: boolean, data?, error?,
  message? }`. Errors use a consistent shape (see `API_DESIGN.md` §Errors).

---

## 8. Real-time Architecture

- Socket.io server is mounted on the same HTTP server as Express
  (`backend/server.js:333`).
- CORS origins mirror the REST API's allowlist.
- Connection lifecycle:
  1. Client connects with auth token in `auth` payload (planned Phase 2).
  2. Server validates token, looks up `organizationId`, joins
     `tenant-<orgId>` and `user-<userId>` rooms.
  3. Server-side emitters broadcast to `tenant-<orgId>` for tenant-scoped
     events (GPS, geofence), `user-<userId>` for personal events (messages,
     assigned work orders).
- Backpressure: `pingInterval: 25000`, `pingTimeout: 60000` to tolerate
  mobile networks.
- Horizontal scaling: when we exceed one API pod, we will add the Socket.io
  Redis adapter (`@socket.io/redis-adapter`) so messages cross pods.

---

## 9. File Storage

- Backend currently serves `/uploads` from the local filesystem
  (`backend/server.js:214`) — appropriate for single-VM deployments only.
- Phase 2 migration: S3-compatible object storage (AWS S3, MinIO, Cloudflare
  R2) behind a `Storage` interface.
- Uploads return **signed URLs** with short TTL (15 min) — clients never
  receive long-lived credentials.
- Multer middleware (`backend/src/middleware/upload.js`) enforces MIME type
  + size limits; virus scan via ClamAV sidecar recommended for Phase 4.
- File metadata is stored on the parent document's `documents` sub-document
  (see `Vehicle.documents`, `Accident.photos`, etc.).

---

## 10. Caching Strategy

| Use case | Key pattern | TTL | Invalidation |
|---|---|---|---|
| User profile + permissions | `user:<id>:brief` | 5 min | on role change, on logout |
| Organization limits | `org:<id>:limits` | 60 min | on plan change |
| Branch lookup | `org:<id>:branches` | 60 min | on branch CRUD |
| Rate-limit counter | `rl:<ip>:<route>` | 15 min | sliding window |
| Idempotency key | `idem:<key>` | 24 h | one-shot |
| Report snapshot | `report:<orgId>:<hash>` | 24 h | on next report run |

Phase 1 uses in-process caches for some of these; the Redis-backed
implementation lands in Phase 2 alongside BullMQ.

---

## 11. Background Jobs

- Broker: Redis + BullMQ (planned Phase 2; Phase 1 ships the interface and
  fire-and-forget audit logging).
- Worker types:
  - **notification-worker** — sends email/SMS/push, retries 5× with
    exponential backoff.
  - **report-worker** — generates scheduled reports (cost-per-km, fuel
    summary, compliance report), uploads to S3, emits event.
  - **ai-prediction-worker** — calls the Python inference service for
    maintenance/fuel/driver-score predictions (Phase 3).
  - **audit-archive-worker** — moves audit records older than 7 years to
    cold storage.
  - **db-maintenance-worker** — TTL expirations, index rebuilds, stats.
- All jobs emit start/complete/failure metrics for Prometheus.

---

## 12. Security Architecture

Detailed in `SECURITY.md`. Summary:

- TLS 1.3 in transit; AES-256 at rest (MongoDB + S3).
- Field-level encryption for PII: `User.profile.nationalId`,
  `User.driverProfile.licenseNumber`, `User.mfa.secret`,
  `User.mfa.backupCodes` (all `select: false`).
- Helmet headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy).
- Rate limit: 100 req / 15 min per IP, configurable per route.
- Per-organization IP allowlist (`Organization.settings.ipWhitelist`).
- Audit logging of every privileged mutation, 7-year retention, immutable.
- OWASP Top 10 compliance map in `SECURITY.md`.

---

## 13. Observability

| Signal | Tool | Where |
|---|---|---|
| Metrics | Prometheus text exposition | `GET /metrics` via `backend/src/middleware/monitoring.js` |
| Metrics dashboards | Grafana | `docs/architecture/DEPLOYMENT.md` shows panel sketch |
| Logs | Structured JSON to stdout | `console.log/error/warn` in `server.js`; structured logger planned Phase 2 |
| Distributed tracing | OpenTelemetry SDK | planned Phase 3 |
| Alerts | Alertmanager | `docs/architecture/DEPLOYMENT.md` lists alert rules |
| Uptime | Blackbox exporter + Render dashboard | external probe to `/health` and `/ready` |

### Exposed metrics
- `http_requests_total{method,route,status}` (counter)
- `http_request_duration_seconds{method,route}` (histogram, default buckets)
- `active_connections` (gauge)
- `http_requests_in_flight` (gauge)
- `db_connections` (gauge)
- `nodejs_memory_heap_used_bytes` (gauge)
- `nodejs_event_loop_lag_seconds` (gauge, sampled every 5 s)

Route labels are normalized: ObjectIds / UUIDs / numeric IDs collapse to
`:id` to bound cardinality (`backend/src/middleware/monitoring.js`).

---

## 14. Scalability Targets

| Resource | Phase 1 capacity | Phase 4 target |
|---|---|---|
| API pods | 3–20 (HPA: 70 % CPU, 80 % memory) | 3–100 |
| Frontend pods | 2 | 2–10 |
| MongoDB shards | 1 (Atlas M10) | 5+ (sharded by `organizationId`) |
| Redis | 1 (single instance) | 1 primary + 2 replicas + Sentinel |
| Socket.io | sticky sessions via Ingress | Redis adapter for cross-pod |
| Storage | local uploads | S3 + CDN (CloudFront / Cloudflare) |
| Concurrent users | 5,000 | 100,000 |
| Throughput | 1,000 rps | 20,000 rps |

### Scaling levers
- **Horizontal**: HPA on CPU/memory; Socket.io Redis adapter; BullMQ workers
  as a separate Deployment.
- **Vertical**: per-pod memory limit adjustable in `k8s/backend-deployment.yaml`.
- **Read replicas**: MongoDB Atlas read replicas for analytics queries
  (`readPreference=secondaryPreferred` on report routes).
- **Sharding**: at 10 M+ docs per collection, shard by `organizationId`
  hashed for even distribution; the compound indexes are already
  `organizationId`-prefixed so the shard key change is non-breaking.
- **CDN**: static assets via Cloudflare/CloudFront; API responses tagged
  with `Cache-Control` where safe (e.g. `GET /api/v1/branches`).

---

## 15. Failure Modes & Mitigations

| Failure | Mitigation |
|---|---|
| MongoDB primary loss | Atlas automatic failover (≤ 30 s); API returns 503 on `readyState != 1` |
| Redis loss | BullMQ jobs paused; API continues serving with degraded caching |
| Pod crash | K8s restarts; readiness probe stops traffic during boot |
| Region loss | Multi-AZ deployment; cross-region backup restore for DR |
| Token compromise | Refresh-token family revocation; `/auth/logout-all` |
| Audit log write failure | Fire-and-forget — request still succeeds; console.error captured |
| Rate-limit storm | Per-IP + per-user + per-endpoint limits; 429 with `Retry-After` |
| Bad migration | Atlas PITR restores to any second in the last 7 days |

---

## 16. Open Architectural Decisions

1. **GraphQL vs REST** — REST is the v1 contract; GraphQL is added as a
   gateway in Phase 4 to support mobile + dashboard optimized queries.
2. **Event sourcing** — not adopted; the `events` sub-document on Vehicle
   and similar models captures lifecycle events without the cost of a full
   event store.
3. **Microservices** — kept monolithic for v1; AI/ML service is the first
   extraction in Phase 3. Further splits deferred until bottlenecks are
   measured.
4. **Multi-region writes** — deferred; v1 is single-region multi-AZ.
5. **Message bus** — BullMQ chosen over Kafka for operational simplicity;
   Kafka reassessed at 100 K rps.
