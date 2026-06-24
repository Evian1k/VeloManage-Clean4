# VeloManage — API Design

| Field | Value |
|---|---|
| Document version | 1.0 |
| Base URL | `https://api.velomanage.example/api/v1` |
| Content type | `application/json; charset=utf-8` |
| Auth scheme | `Authorization: Bearer <access-token>` |
| Related files | `backend/server.js`, `backend/src/routes/*`, `backend/src/routes/modules/*`, `backend/src/routes/crudFactory.js` |

---

## 1. REST API Conventions

### 1.1 URL structure
- All API routes are prefixed with `/api/v1` (configurable via `API_VERSION`
  env var, default `v1`).
- Resource paths use plural nouns: `/api/v1/vehicles`, `/api/v1/drivers`.
- Sub-resources are nested one level deep: `/api/v1/vehicles/:id/maintenance`,
  `/api/v1/drivers/:id/trips`. Deeper relationships are accessed by query
  parameter on the parent resource (e.g. `GET /api/v1/trips?driverId=:id`).
- Business actions are sub-resource paths with a verb:
  `POST /api/v1/vehicles/:id/retire`,
  `POST /api/v1/maintenance/:id/approve`.

### 1.2 HTTP methods
| Method | Intent | Idempotent |
|---|---|---|
| GET | read; never mutates | yes |
| POST | create; non-idempotent unless `Idempotency-Key` header provided | no |
| PUT | full replace of resource | yes |
| PATCH | partial update (VeloManage uses PUT for partial updates — see §1.5) | no |
| DELETE | soft-delete (`isActive=false`) unless hard-delete is explicitly documented | yes |

### 1.3 Status codes
| Code | Meaning |
|---|---|
| 200 OK | success on GET, PUT, PATCH, DELETE |
| 201 Created | success on POST |
| 204 No Content | success on DELETE when no body returned |
| 400 Bad Request | validation error, malformed JSON |
| 401 Unauthorized | missing/invalid/expired token |
| 403 Forbidden | authenticated but RBAC denied, or cross-tenant access |
| 404 Not Found | resource does not exist or belongs to another tenant |
| 409 Conflict | duplicate key (e.g. email already exists) |
| 422 Unprocessable Entity | semantic validation failure (reserved for future use) |
| 429 Too Many Requests | rate limit exceeded; `Retry-After` header set |
| 500 Internal Server Error | unhandled server error; logged with traceId |
| 503 Service Unavailable | DB disconnected or maintenance mode |

### 1.4 Response envelope
Every response (success or error) uses the same JSON envelope:

```json
// success
{
  "success": true,
  "data": { ... } | [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 137, "totalPages": 7, "hasNext": true, "hasPrev": false }
}

// error
{
  "success": false,
  "error": "ValidationError",
  "message": "Vehicle validation failed: licensePlate is required.",
  "details": [
    { "field": "licensePlate", "message": "Path `licensePlate` is required." }
  ],
  "traceId": "abc123"
}
```

### 1.5 Pagination
All list endpoints accept:
- `page` (1-based; default 1; values < 1 are clamped to 1)
- `limit` (default 20; max 200; values > 200 are clamped to 200)
- `sort` — comma-separated list of fields, `-` prefix for descending
  (e.g. `sort=-createdAt,licensePlate`)
- `fields` — comma-separated projection (e.g. `fields=vehicleId,licensePlate,status`)
- `populate` — comma-separated relations to populate
  (e.g. `populate=assignedDriverId,branchId`)

Response includes a `pagination` object (see envelope above).

### 1.6 Filtering
- Equality: `?status=active` → `{ status: 'active' }`
- Boolean coercion: `?isActive=true` → `{ isActive: true }`
- ObjectId: `?branchId=507f1f77bcf86cd799439011` → `{ branchId: ObjectId(...) }`
- Multi-value (`$in`): `?type=truck,van` → `{ type: { $in: ['truck','van'] } }`
- Date range (planned): `?createdAt.gte=2026-01-01&createdAt.lte=2026-06-30`
- Search: `?search=toyota` — builds `$or` regex against the model's
  `SEARCH_FIELDS` (handled by `createCrudRouter` in
  `backend/src/routes/crudFactory.js`).

### 1.7 Field selection
`?fields=vehicleId,licensePlate,status,assignedDriverId` projects only the
named fields; `__v` is always excluded; sensitive fields (`password`,
`refreshTokens`, `mfa.secret`) are excluded at the schema level.

### 1.8 Populate
`?populate=assignedDriverId,branchId` triggers `Model.populate()` on the
named paths. `createCrudRouter` accepts a `populate` option per route to
restrict which fields may be populated (defense against deep-populate DoS).

---

## 2. Authentication

### 2.1 Bearer token
Every authenticated request must include:
```
Authorization: Bearer <access-token>
```
The `authenticateToken` middleware (`backend/src/middleware/auth.js:5`)
verifies the JWT, loads the user from MongoDB, and rejects with 401 on
missing/invalid/expired tokens.

### 2.2 Token lifecycle
| Token | TTL | Storage | Signed with |
|---|---|---|---|
| Access | 15 min (`JWT_ACCESS_EXPIRES_IN`) | client memory / localStorage | `JWT_SECRET` |
| Refresh | 30 days (`JWT_REFRESH_EXPIRES_IN`) | httpOnly cookie or secure storage; SHA-256 hash stored in `User.refreshTokens` | `JWT_REFRESH_SECRET` (fallback: `JWT_SECRET`) |

### 2.3 Refresh flow
```
POST /api/v1/auth/refresh
  body: { refreshToken: "..." }
→ if valid: { accessToken, refreshToken: <new>, family: <same> }
→ old refresh token revoked, new one issued in same family
→ if revoked token replayed: entire family revoked (reuse detection)
```

### 2.4 Logout
- `POST /api/v1/auth/logout` — body `{ refreshToken }`; revokes one token.
- `POST /api/v1/auth/logout-all` — revokes every refresh token for the user.
- `GET /api/v1/auth/sessions` — lists active sessions with device info.

### 2.5 MFA (TOTP) — Phase 2
- `POST /api/v1/auth/mfa/setup` returns `{ secret, qrUrl }`.
- `POST /api/v1/auth/mfa/verify` body `{ code }` enables MFA.
- Login flow when MFA is enabled returns
  `{ mfaRequired: true, mfaToken: <short-lived> }` instead of access token;
  client then calls `POST /api/v1/auth/mfa/challenge` with
  `{ mfaToken, code }`.

### 2.6 OAuth & SSO — Phase 4
- `GET /api/v1/auth/oauth/google` — initiates Google OAuth flow.
- `GET /api/v1/auth/oauth/microsoft` — initiates Microsoft flow.
- `POST /api/v1/auth/saml/login` — SAML SP-initiated login.
- On first OAuth login, a `User` is created with `oauth.google.id` set;
  no password is generated.

---

## 3. Error Response Format

Errors are produced by the global `errorHandler` middleware
(`backend/src/middleware/errorHandler.js`). All errors follow the envelope
shown in §1.4. Specific translations:

| Source | statusCode | error | message |
|---|---|---|---|
| express-validator | 400 | ValidationError | first validation message |
| Mongoose `ValidationError` | 400 | ValidationError | aggregated messages |
| Mongoose duplicate key (code 11000) | 409 | ConflictError | "Resource already exists" + index name |
| Mongoose `CastError` | 400 | CastError | "Invalid <field>: <value>" |
| `JsonWebTokenError` | 401 | AuthError | "Invalid token." |
| `TokenExpiredError` | 401 | AuthError | "Token expired." |
| Custom `ApiError(statusCode, message)` | passthrough | ApiError | message |
| Unknown | 500 | InternalServerError | "Internal server error" (stack in `dev` only) |

Errors include a `traceId` (set by `req.id` middleware — planned Phase 2)
so support tickets can be traced end-to-end.

---

## 4. Rate Limiting

| Scope | Limit | Window | Headers |
|---|---|---|---|
| Global per IP | 100 req | 15 min | `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` |
| Auth routes (`/auth/login`, `/auth/refresh`) | 10 req | 10 min per IP+email | same |
| Password reset | 3 req | 1 hour per email | same |
| Export endpoints | 5 req | 1 hour per user | same |
| Write endpoints (POST/PUT/DELETE) | 60 req | 1 min per user | same |

Configured via `express-rate-limit` in `backend/server.js:194`. The limit
is overridable per route via the route's own `rateLimit()` instance.

When the limit is exceeded, the API returns 429 with:
```json
{ "success": false, "error": "Too many requests from this IP, please try again later." }
```
and a `Retry-After` header in seconds.

Phase 2 will move counters to Redis (`rate-limit-redis`) so the limit is
enforced across all API pods.

---

## 5. Endpoint Inventory

All routes below are mounted in `backend/server.js:296-328`. The 13
enterprise module routes use the `createCrudRouter` factory
(`backend/src/routes/crudFactory.js`) which generates the standard
CRUD endpoints (`GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`)
plus custom business endpoints registered per module.

### 5.1 Auth (`/api/v1/auth`)
| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/register` | public | creates user + optionally organization |
| POST | `/login` | public | returns access + refresh tokens |
| POST | `/refresh` | public (refresh token) | rotates refresh token |
| POST | `/logout` | authenticated | revokes one refresh token |
| POST | `/logout-all` | authenticated | revokes all refresh tokens |
| GET | `/verify` | authenticated | returns current user |
| GET | `/sessions` | authenticated | lists active sessions |
| POST | `/change-password` | authenticated | checks password history |
| POST | `/password-reset/request` | public | sends reset email |
| POST | `/password-reset/confirm` | public | resets password with token |

### 5.2 Organizations (`/api/v1/organizations`)
| Method | Path | Permission |
|---|---|---|
| GET | `/` | `organization:read` |
| GET | `/:id` | `organization:read` |
| POST | `/` | platform admin only |
| PUT | `/:id` | `organization:write` |
| DELETE | `/:id` | platform admin only |
| PUT | `/:id/suspend` | platform admin only |
| PUT | `/:id/reactivate` | platform admin only |
| GET | `/:id/usage` | `organization:read` |

### 5.3 Audit (`/api/v1/audit`)
| Method | Path | Permission |
|---|---|---|
| GET | `/` | `audit:read` |
| GET | `/:id` | `audit:read` |
| GET | `/export` | `audit:read` + `reports:export` |
| GET | `/stats` | `audit:read` |

### 5.4 Vehicles (`/api/v1/vehicles`)
CRUD + `PUT /:id/assign-driver`, `PUT /:id/unassign-driver`,
`PUT /:id/location`, `PUT /:id/odometer`, `POST /:id/retire`,
`POST /:id/dispose`, `GET /:id/history`, `GET /:id/events`,
`POST /:id/documents`, `GET /stats/summary`.

### 5.5 Drivers (`/api/v1/drivers`)
CRUD + `PUT /:id/assign-vehicle`, `POST /:id/license-renew`,
`GET /:id/score`, `GET /:id/trips`, `GET /:id/attendance`.

### 5.6 Maintenance (`/api/v1/maintenance`)
CRUD + `POST /:id/approve`, `POST /:id/start`, `POST /:id/complete`,
`POST /:id/parts`, `GET /upcoming`, `GET /stats/downtime`.

### 5.7 Fuel (`/api/v1/fuel`)
CRUD + `GET /analytics/consumption`, `GET /anomalies`,
`POST /:id/reconcile`, `GET /cards` (fuel cards).

### 5.8 Trips (`/api/v1/trips`)
CRUD + `POST /:id/dispatch`, `POST /:id/start`, `POST /:id/complete`,
`GET /:id/route`, `GET /stats/duration`.

### 5.9 Geofences (`/api/v1/geofences`)
CRUD + `POST /:id/test`, `GET /events`, `GET /:id/breaches`.

### 5.10 Compliance (`/api/v1/compliance`)
CRUD + `GET /expiring`, `POST /:id/renew`, `GET /report/:period`,
`GET /stats/findings`.

### 5.11 Accidents (`/api/v1/accidents`)
CRUD + `POST /:id/claim`, `POST /:id/photos`, `GET /:id/timeline`,
`GET /stats/by-cause`.

### 5.12 Finance (`/api/v1/finance`)
CRUD + `POST /:id/approve`, `GET /reports/pnl`, `GET /reports/cost-per-km`,
`POST /budgets`, `GET /budgets`, `PUT /budgets/:id`,
`GET /contracts`, `POST /contracts`.

### 5.13 Assets (`/api/v1/assets`)
CRUD + `PUT /:id/assign`, `POST /:id/audit`, `GET /:id/depreciation`,
`GET /stats/utilization`.

### 5.14 Vendors (`/api/v1/vendors`)
CRUD + `GET /:id/performance`, `POST /:id/contract`, `GET /:id/orders`,
`GET /stats/by-category`.

### 5.15 Customers (`/api/v1/customers`)
CRUD + `GET /:id/contracts`, `GET /:id/jobs`, `POST /:id/contact`,
`GET /:id/service-history`.

### 5.16 Staff (`/api/v1/staff`)
CRUD + `POST /:id/leave`, `POST /:id/attendance`, `GET /:id/payroll`,
`GET /:id/training`, `POST /:id/training`.

### 5.17 Legacy routes (kept for backward compatibility)
`/api/v1/users`, `/api/v1/services`, `/api/v1/trucks`, `/api/v1/messages`,
`/api/v1/pickups`, `/api/v1/branches`, `/api/v1/bookings`,
`/api/v1/analytics`, `/api/v1/dashboard`, `/api/v1/locations`,
`/api/v1/payments`. These will be deprecated in Phase 3 with sunset headers
and removed in Phase 4.

---

## 6. GraphQL Schema Sketch (Future — Phase 4)

A GraphQL gateway will sit in front of the REST API to support
dashboard-optimized queries. Sketch:

```graphql
# Types
type Vehicle {
  id: ID!
  vehicleId: String!
  licensePlate: String!
  type: VehicleType!
  status: VehicleStatus!
  assignedDriver: Driver
  currentLocation: GeoPoint
  maintenance: MaintenanceSummary!
  odometer: Odometer!
  events(limit: Int = 20, before: DateTime): [VehicleEvent!]!
}

type Driver {
  id: ID!
  user: User!
  licenseNumber: String!
  assignedVehicle: Vehicle
  score: Float
  trips(from: DateTime, to: DateTime): [Trip!]!
}

type Trip {
  id: ID!
  vehicle: Vehicle!
  driver: Driver
  startTime: DateTime!
  endTime: DateTime
  distanceKm: Float
  status: TripStatus!
  route: [GeoPoint!]!
}

# Queries
type Query {
  me: User!
  vehicle(id: ID!): Vehicle
  vehicles(filter: VehicleFilter, page: Int, limit: Int): VehiclePage!
  driver(id: ID!): Driver
  trips(filter: TripFilter, page: Int, limit: Int): TripPage!
  fleetSummary(orgId: ID, from: DateTime, to: DateTime): FleetSummary!
  costPerKm(orgId: ID, from: DateTime!, to: DateTime!): [VehicleCost!]!
  auditLog(filter: AuditFilter, page: Int, limit: Int): AuditLogPage!
}

# Mutations
type Mutation {
  createVehicle(input: CreateVehicleInput!): Vehicle!
  updateVehicle(id: ID!, input: UpdateVehicleInput!): Vehicle!
  assignDriver(vehicleId: ID!, driverId: ID!, reason: String): Vehicle!
  retireVehicle(id: ID!, reason: String!): Vehicle!
  createMaintenanceWorkOrder(input: CreateWorkOrderInput!): MaintenanceWorkOrder!
  approveMaintenance(id: ID!): MaintenanceWorkOrder!
  logFuel(input: FuelTransactionInput!): FuelTransaction!
  createTrip(input: CreateTripInput!): Trip!
  dispatchTrip(id: ID!, driverId: ID!, vehicleId: ID!): Trip!
}

# Subscriptions (over WebSocket)
type Subscription {
  vehicleLocationUpdated(orgId: ID!): VehicleLocationEvent!
  geofenceBreach(orgId: ID!): GeofenceEvent!
  workOrderAssigned(userId: ID!): MaintenanceWorkOrder!
  alertReceived(orgId: ID!): Alert!
}
```

The gateway will be implemented with Apollo Server in a separate pod; it
will resolve data by calling the existing REST endpoints (via
`@apollo/rest-datasource`) so the REST contract remains authoritative.

---

## 7. Webhooks

Webhooks let external systems react to VeloManage events. Framework ships in
Phase 4.

### 7.1 Event types
| Event | Trigger | Payload shape |
|---|---|---|
| `vehicle.created` | POST /vehicles | `{ vehicle, organizationId, timestamp }` |
| `vehicle.retired` | POST /vehicles/:id/retire | `{ vehicle, reason, performedBy }` |
| `maintenance.created` | POST /maintenance | `{ workOrder }` |
| `maintenance.completed` | POST /maintenance/:id/complete | `{ workOrder, parts, labor }` |
| `fuel.anomaly_detected` | AI worker | `{ fuelTransaction, anomalyScore }` |
| `trip.completed` | POST /trips/:id/complete | `{ trip, distanceKm, durationMin }` |
| `geofence.breach` | real-time worker | `{ vehicle, geofence, event }` |
| `compliance.expiring` | daily cron | `{ complianceItems[], daysToExpiry }` |
| `accident.reported` | POST /accidents | `{ accident, vehicle, driver }` |
| `finance.approved` | POST /finance/:id/approve | `{ transaction, approvedBy }` |

### 7.2 Payload format
```json
{
  "event": "vehicle.retired",
  "id": "evt_abc123",
  "timestamp": "2026-06-24T10:30:00.000Z",
  "organizationId": "507f1f77bcf86cd799439011",
  "data": { ... }
}
```

### 7.3 Signature verification
Each webhook delivery includes:
```
X-VeloManage-Signature: t=1719227600,v1=hex(hmac_sha256(secret, "${t}.${body}"))
```
Receivers reconstruct the signature and verify before processing. A
timestamp skew > 5 min is rejected to prevent replay.

### 7.4 Retry policy
- Delivery attempts: 1 initial + 4 retries with exponential backoff
  (5 min, 30 min, 2 h, 6 h, 12 h).
- A webhook is auto-disabled after 100 consecutive failures or 24 h of
  failures; owner is notified by email.
- Delivery logs (request, response, latency, status) are retained for 30
  days for debugging.

---

## 8. OpenAPI / Swagger Integration (Phase 4)

Plan:
1. Annotate every route handler with JSDoc-style OpenAPI comments using
   `swagger-jsdoc`.
2. Generate the spec at build time; serve at `GET /api/v1/openapi.json`.
3. Serve Swagger UI at `/docs` and ReDoc at `/redoc`.
4. Validate every response against the spec in CI via `openapi-validator`.
5. Use the spec to auto-generate SDKs (§9).

Coverage target: 100 % of `/api/v1/*` routes documented with request,
response, error codes, and example payloads.

---

## 9. SDK Architecture (Phase 4)

Generated from the OpenAPI spec using `openapi-generator`:

| SDK | Language | Package | Use case |
|---|---|---|---|
| `@velomanage/js` | TypeScript / Node.js | npm | server-side integrations, official CLI |
| `@velomanage/python` | Python 3.9+ | PyPI | data science, AI/ML notebooks, scripts |
| `@velomanage/go` | Go 1.21+ | GitHub module | high-throughput backend integrations |
| `velomanage-php` | PHP 8.2+ | Packagist | legacy CMS integrations (community-supported) |

All SDKs share a uniform surface: `client.vehicles.list({ filter })`,
`client.vehicles.create({ ... })`, `client.maintenance.approve(id)`.
Authentication is set once on the client (`new VeloManage({ apiKey })`);
the SDK handles token refresh transparently.

The SDKs include:
- automatic retries on 5xx with exponential backoff
- request signing for webhooks verification helper
- typed responses matching the OpenAPI schema
- a CLI mode (`velomanage vehicles list --org=...`) for ad-hoc ops

---

## 9. Versioning Strategy

### URL-based versioning
- `/api/v1` is the current contract (Phase 1 baseline).
- `/api/v2` will be introduced alongside v1 for breaking changes; both run
  in parallel for a minimum of 12 months.
- Old versions are never silently broken; bug fixes backport to all
  supported major versions.

### Deprecation policy
1. New minor version is released that supports both old and new behavior.
2. Old behavior is marked deprecated: response header
   `Deprecation: true` + `Sunset: <RFC-7231 date>`.
3. Migration guide published in `docs/migrations/v1-to-v2.md`.
4. After 12 months or 95 % traffic migration (whichever is later), the old
   version is removed.
5. Removal announced via email to all API consumers 90 days in advance.

### Compatibility rules
- **Breaking**: removing a field, changing a field type, changing status
  codes, changing semantics of an existing endpoint.
- **Non-breaking**: adding a new field, adding a new endpoint, adding a new
  optional query parameter, adding a new status code for an explicitly new
  condition.

All changes are tracked in `docs/api/CHANGELOG.md` (planned).

---

## 10. Cross-Cutting Concerns

### 10.1 Idempotency
`POST` endpoints that create resources or trigger side effects accept an
`Idempotency-Key` header. The server caches the response keyed by
`<userId>:<key>` for 24 h; a duplicate request returns the cached response
without re-executing. Implementation planned Phase 2 with Redis backend.

### 10.2 Request IDs
Every request is tagged with a `X-Request-Id` header (set by the client or
generated by the API). The ID propagates to logs, audit entries, and error
responses as `traceId`.

### 10.3 CORS
- Allowlist-based: origins in `FRONTEND_URL` + `ADDITIONAL_CORS_ORIGINS`.
- Credentials allowed (`Authorization`, cookies).
- Methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
- Per-tenant allowlist planned Phase 4 (custom-domain routing).

### 10.4 Compression
- Responses gzip-compressed for `Accept-Encoding: gzip` (handled by NGINX
  in `frontend/nginx.conf`).
- Request body limit: 10 MB (set in `backend/server.js:210`).

### 10.5 File uploads
- Multipart uploads handled by `multer` in `backend/src/middleware/upload.js`.
- Phase 2: presigned S3 URLs returned by `POST /api/v1/uploads/sign`;
  client uploads directly to S3, then notifies the API with the resulting
  object key.
