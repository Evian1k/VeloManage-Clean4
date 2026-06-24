# VeloManage — Data Flow

| Field | Value |
|---|---|
| Document version | 1.0 |
| Status | Phase 1 baseline + Phase 2-4 planned flows |
| Related files | `backend/server.js`, `backend/src/middleware/{auth,tenant,rbac,audit}.js`, `backend/src/routes/crudFactory.js` |

This document traces the four canonical data flows in VeloManage: a
synchronous HTTP request, a real-time event, a background job, and an
AI inference call. Each is described step-by-step with file references.

---

## 1. Request Lifecycle (Synchronous HTTP)

A typical request: `PUT /api/v1/vehicles/507f1f77bcf86cd799439011` to
update a vehicle's status.

```
Client (browser/mobile/SDK)
  │
  │  HTTPS PUT /api/v1/vehicles/:id
  │  Authorization: Bearer <access-token>
  │  Body: { "status": "in_maintenance" }
  ▼
NGINX Ingress (TLS termination, path routing)
  │
  ▼
Express app (backend/server.js)
  │
  ├─ helmet()                 → security headers
  ├─ cors()                   → origin allowlist check
  ├─ rateLimit                → per-IP counter (in-process / Redis)
  ├─ requestMetricsMiddleware → records start time, route label
  ├─ express.json()           → parse body
  │
  ▼
authenticateToken (backend/src/middleware/auth.js:5)
  │  - extract Bearer token
  │  - jwt.verify(token, JWT_SECRET)
  │  - User.findById(decoded.userId)
  │  - reject if !user || !user.isActive → 401
  │  - attach req.user
  ▼
attachTenant (backend/src/middleware/tenant.js:18)
  │  - resolve organizationId from req.user or x-organization-id
  │  - Organization.findById(orgId)
  │  - reject if org inactive → 403
  │  - attach req.tenant, req.tenantId
  ▼
RBAC middleware (backend/src/middleware/rbac.js)
  │  - requirePermission('vehicles:write')
  │  - roleHasPermission(role, 'vehicles:write')
  │  - reject if not allowed → 403
  ▼
Route handler (backend/src/routes/modules/vehicles.js)
  │  - validateTenantOwnership('Vehicle', 'params', 'id')
  │  - build filter = { ...req.tenantFilter(), _id: req.params.id }
  │  - capture before = await Vehicle.findOne(filter).lean()
  │  - apply update via Vehicle.findOneAndUpdate(filter, body, { new: true })
  │  - capture after = updated vehicle
  ▼
recordAudit (backend/src/models/AuditLog.js:108)
  │  - sanitizeForLog(before), sanitizeForLog(after)
  │  - AuditLog.create({ userId, action: 'vehicle.update',
  │                     before, after, statusCode: 200, ... })
  │  - fire-and-forget (does not block response)
  ▼
Express response
  │  - { success: true, data: updatedVehicle }
  │  - requestMetricsMiddleware records duration + status
  ▼
Client receives 200 OK + JSON body
```

### Edge cases
- **401**: token missing/invalid → no audit log written (auth failure).
- **403**: RBAC denied → audit log written with `status: denied`,
  `severity: warning`.
- **404**: tenant ownership check fails → audit log written with
  `status: failure` (avoids leaking existence via 403).
- **500**: unhandled error → errorHandler returns 500; audit log
  written with `status: failure`, `severity: critical`; traceId in
  response so user can report the incident.

### Performance budget
| Stage | Budget |
|---|---|
| Ingress + middleware (helmet, cors, rateLimit, json) | 5 ms |
| `authenticateToken` (JWT verify + User.findById) | 20 ms |
| `attachTenant` (Organization.findById, cached) | 5 ms |
| RBAC check (in-memory) | < 1 ms |
| Route handler (1-2 DB ops) | 50-150 ms |
| Audit log write (async) | 5-20 ms (parallel to response) |
| Total p95 target | < 300 ms |

---

## 2. Real-time Event Flow

A telematics device sends a GPS ping for a vehicle. The flow updates
the vehicle's location and broadcasts to subscribed clients.

```
Telematics device (in-vehicle)
  │
  │  HTTPS POST /api/v1/integrations/telematics/:provider
  │  X-Device-Id: <device_id>
  │  Body: { lat, lng, heading, speed, odometer, timestamp }
  ▼
Ingestion route (planned Phase 2: backend/src/routes/integrations/telematics.js)
  │  - authenticate device (API key + device registry)
  │  - resolve vehicle by telematics.deviceId
  │  - rate-limit per device (1 ping/sec)
  ▼
Update vehicle
  │  - Vehicle.updateOne({ _id: vehicleId },
  │       { $set: { 'currentLocation': { lat, lng, heading, speed, ... },
  │                  'odometer.current': odometer, 'telematics.lastPingAt': now } })
  │  - push to Vehicle.odometer.history (if odometer changed)
  ▼
Geofence check (Phase 2)
  │  - Geofence.find({ organizationId })
  │  - for each: $geoIntersects query
  │  - if breach: emit geofence event (see below)
  ▼
Socket.io emit
  │  - io.to(`tenant-${orgId}`).emit('gps.update', { vehicleId, location })
  │  - if geofence breach:
  │      io.to(`tenant-${orgId}`).emit('geofence.breach', { vehicleId, geofenceId })
  │      io.to(`user-${fleetManagerId}`).emit('alert.critical', { ... })
  ▼
Socket.io Redis adapter (Phase 2)
  │  - publishes to Redis pub/sub channel
  │  - all API pods subscribed to the channel receive the event
  │  - each pod delivers to its connected clients in the room
  ▼
Client (browser dashboard, mobile app)
  │  - receives 'gps.update' event
  │  - updates map marker position
  │  - if 'alert.critical': shows notification banner + plays sound
```

### Latency budget
| Stage | Budget |
|---|---|
| Device → Ingestion route | 100-500 ms (depends on cellular) |
| Ingestion + DB update | 30-50 ms |
| Geofence check (cached geofences) | 5-20 ms |
| Socket.io emit (local pod) | 1-5 ms |
| Cross-pod via Redis adapter | 5-15 ms |
| Client render | 10-30 ms |
| Total p95 target | < 2 s end-to-end |

---

## 3. Background Job Flow

A user uploads a CSV of fuel transactions. The file is parsed in the
background to avoid blocking the request.

```
Client (browser)
  │
  │  POST /api/v1/fuel/import
  │  multipart/form-data: file=fuel.csv
  ▼
Express route (backend/src/routes/modules/fuel.js)
  │  - multer middleware saves file to /tmp or S3
  │  - create a Job document in BullMQ queue 'fuel-import'
  │  - return 202 Accepted with { jobId }
  ▼
Client polls or subscribes
  │  - GET /api/v1/fuel/import/:jobId (status: queued/processing/completed/failed)
  │  - OR socket.io 'job.update' event for live progress

  ── background ─────────────────────────────────────────

BullMQ worker (fuel-import-worker pod, planned Phase 2)
  │  - dequeues job from Redis queue 'fuel-import'
  │  - fetches file from S3
  │  - parses CSV row by row
  │  for each row:
  │    - validate (vehicleId exists, amount > 0, etc.)
  │    - FuelTransaction.create({ ... })
  │    - increment progress counter
  │    - emit progress every 100 rows (socket.io 'job.progress')
  │  - on completion: emit 'job.completed' with summary
  │  - on failure: emit 'job.failed' with error; retry 3× with backoff
  ▼
Side effects
  │  - notification-worker sends email to user:
  │    "Fuel import complete: 998 rows imported, 2 rows failed"
  │  - recordAudit({ action: 'fuel.import', statusCode: 200, ... })
  │  - if anomaly detection (Phase 3): enqueue fuel-anomaly job
  ▼
Worker waits for next job
```

### Job states
- `queued` — added to Redis, waiting for a worker.
- `active` — picked up by a worker.
- `completed` — finished successfully.
- `failed` — exhausted retries.
- `delayed` — scheduled for future execution.
- `paused` — queue paused by admin.

### Failure handling
- Each job has `attempts: 3` and `backoff: { type: 'exponential', delay: 5000 }`.
- Failed jobs are moved to a dead-letter queue after exhaustion.
- Alertmanager fires if dead-letter queue length > 0.

---

## 4. AI Inference Flow

A scheduled job runs daily to predict which vehicles are likely to need
maintenance in the next 30 days.

```
Cron scheduler (BullMQ scheduled job, daily 02:00 UTC)
  │
  ▼
Prediction orchestrator (backend/src/jobs/maintenance-prediction.js, planned Phase 3)
  │  - fetch list of active vehicles per organization
  │  - for each vehicle (batched, 100 at a time):
  │    - enqueue a 'maintenance-prediction' job with vehicleId
  ▼
BullMQ worker (ai-prediction-worker pod, Python service, planned Phase 3)
  │  - dequeues job
  │  - calls Python inference service:
  │      POST https://ai.velomanage.internal/predict
  │      Body: { model: 'maintenance-lstm', vehicleId, features: {...} }
  ▼
Python inference service (ai/ directory, planned Phase 3)
  │  - load features:
  │      - telematics history (last 90 days, hourly aggregates)
  │      - work order history (last 12 months)
  │      - odometer trajectory
  │      - vehicle metadata (make, model, year, type)
  │  - run model.predict(features)
  │  - return: {
  │      predictedFailureDate: '2026-07-15',
  │      component: 'brake_pads',
  │      probability: 0.78,
  │      featureAttribution: { ... }
  │    }
  ▼
Worker processes prediction
  │  - if probability > 0.6:
  │    - create a MaintenanceWorkOrder with type='planned',
  │      priority based on probability, scheduledAt=predictedFailureDate - 7d
  │    - recordAudit({ action: 'ai.prediction', category: 'maintenance',
  │                    severity: 'info', after: prediction })
  │  - emit socket.io 'maintenance.predicted' to fleet_manager's user room
  │  - notification-worker sends email to fleet manager
  ▼
Fleet manager UI
  │  - sees new "AI-suggested" work order in the maintenance queue
  │  - can approve (status: open), defer (status: deferred with reason),
  │    or dismiss (status: rejected with feedback)
  │  - feedback is recorded for model retraining
```

### Inference service contract
All AI features follow a uniform contract:

```
POST /predict
Body: {
  model: 'maintenance-lstm' | 'fuel-anomaly-iso' | 'driver-score-xgb' | 'demand-prophet' | 'route-opt',
  organizationId,
  entityId,
  features: { ... }
}
Response: {
  prediction: { ... },
  probability?: number,
  featureAttribution?: { feature: weight, ... },
  modelVersion: 'maintenance-lstm-v1.2.3',
  inferenceTimeMs: number
}
```

### Performance budget
| Stage | Budget |
|---|---|
| Cron trigger | < 1 s |
| Feature extraction (per vehicle) | 200-500 ms |
| Model inference | 50-500 ms (depends on model) |
| Persistence + notification | 50-100 ms |
| Total per vehicle | < 1 s |
| 1000 vehicles / 100 batch | ~10 s wall clock |

### Model lifecycle
1. Training: weekly job in ML pipeline (Vertex AI / SageMaker).
2. Validation: held-out test set per pilot customer; precision/recall
   threshold enforced.
3. Deployment: model artifact uploaded to model registry; inference
   service hot-reloads.
4. Monitoring: prediction distribution drift detected via Prometheus
   histogram; alert if drift > threshold.
5. Retirement: old version kept for 30 days for A/B comparison.

---

## 5. Cross-Flow Concerns

### 5.1 Trace ID propagation
- Every HTTP request gets a `traceId` (from `X-Request-Id` header or
  generated).
- `traceId` propagates to:
  - audit log entries (`AuditLog.traceId`)
  - BullMQ job metadata
  - inference service calls (HTTP header)
  - structured logs (JSON field)
- OpenTelemetry SDK (Phase 3) will propagate spans across all these
  boundaries automatically.

### 5.2 Idempotency
- Write endpoints accept `Idempotency-Key` header.
- Key is cached in Redis for 24 h with the response body.
- Duplicate requests return the cached response without re-executing.
- Critical for mobile clients on flaky networks (Phase 2).

### 5.3 Caching
- Hot reads (organization limits, branch list, user permissions)
  cached in Redis with TTL.
- Cache invalidation on write (write-through): write to DB → delete
  cache key → next read repopulates.

### 5.4 Backpressure
- BullMQ workers have a concurrency limit (default: 10).
- If queue grows beyond 1000 jobs, alertmanager fires; autoscale
  workers.
- HTTP API has a global rate limit (100 req / 15 min / IP) plus
  per-route limiters on heavy endpoints.
