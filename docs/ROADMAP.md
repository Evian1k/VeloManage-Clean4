# VeloManage — Release Roadmap

| Field | Value |
|---|---|
| Document version | 1.0 |
| Total duration | 18 months |
| Cadence | 4 phases of 3, 3, 6, 6 months |
| Related files | `docs/GAP_ANALYSIS.md`, `docs/PRD.md`, `docs/architecture/*` |

This roadmap commits the VeloManage team to a sequenced delivery of a
production fleet management platform. Phase 1 is delivered in this commit;
Phases 2–4 are scoped, sized, and dependencies identified.

---

## Phase 1 — Foundation (Months 1-3) — DONE in this commit

**Theme:** Build the multi-tenant backbone, RBAC, audit trail, and the
deployment pipeline. No mobile, no real-time, no AI — just a rock-solid
foundation that every later phase builds on.

### Deliverables
- Multi-tenant data model: `Organization` is the root tenant; every domain
  document carries `organizationId`; isolation enforced by
  `attachTenant` + `tenantFilter` (`backend/src/middleware/tenant.js`).
- 16-role RBAC matrix with permission naming `<module>:<action>[:<scope>]`
  (`backend/src/config/rbac.js`).
- 13 enterprise module routers built on `createCrudRouter`
  (`backend/src/routes/crudFactory.js`):
  vehicles, drivers, maintenance, fuel, trips, geofences, compliance,
  accidents, finance, assets, vendors, customers, staff.
- 26 Mongoose models (`backend/src/models/`) covering the full fleet
  lifecycle.
- JWT auth with access (15 min) + refresh (30 d) rotation and reuse
  detection (`backend/src/routes/auth.js`, `backend/src/models/User.js`).
- Refresh token family, login lockout, password history, MFA schema.
- Immutable audit log with 7-year TTL
  (`backend/src/models/AuditLog.js`).
- Docker: multi-stage `Dockerfile` for backend + frontend, `docker-compose`
  with Mongo + Redis + healthchecks.
- Kubernetes: namespace, deployments, services, Ingress, HPA, PDB,
  ConfigMap, Secret template (`k8s/`).
- CI/CD: GitHub Actions `ci.yml` (backend test, frontend build, docker
  build, multi-arch push) + `deploy.yml` (Render auto-deploy on main).
- Prometheus metrics endpoint at `/metrics`
  (`backend/src/middleware/monitoring.js`).
- Jest test scaffolding: 329 tests across 15 suites
  (`backend/tests/`); 30 % coverage threshold enforced.

### Dependencies
- None external. MongoDB Atlas account provisioned. Render account
  provisioned. GitHub repo + Actions enabled.

### Team required
| Role | FTE |
|---|---|
| Backend engineer (Node/Express/Mongoose) | 2 |
| Frontend engineer (React/Vite) | 1 |
| DevOps engineer (Docker/K8s/CI) | 0.5 |
| QA engineer (Jest/integration) | 0.5 |
| Tech lead / architect | 0.5 |
| **Total** | **4.5 FTE × 3 months = 13.5 FTE-months** |

### Estimated effort
- ~540 person-days delivered (excluding management overhead).

### Closure criteria (all met)
1. 13 module routes respond to standard CRUD with tenant filter.
2. 16-role RBAC matrix tested (`backend/tests/unit/rbac.test.js`).
3. Every privileged mutation writes an `AuditLog` entry.
4. JWT access + refresh with family-based rotation works end-to-end
   (`backend/tests/integration/auth.test.js`).
5. `docker compose up` brings up the stack with healthchecks passing.
6. `kubectl apply -f k8s/` deploys to a target cluster with HPA + PDB +
   Ingress.
7. 329 tests pass; coverage threshold enforced at 30 % baseline.

---

## Phase 2 — Mobile + Real-time (Months 4-6)

**Theme:** Take the foundation to the field. Ship a React Native mobile
app, real-time GPS tracking, geofence alerts, and a live map dashboard.

### Deliverables
- **React Native app** (`mobile/` — new directory)
  - Offline-first with sync engine (watermelondb or custom)
  - Conflict resolution by `updatedAt` timestamp
  - Role-tailored UI: Driver, Mechanic, Fleet Manager
  - Push notifications via APNs + FCM
  - Background GPS capture for Driver role
  - QR/barcode scanning (VIN lookup, parts receipt, fuel-card pairing)
  - Biometric login (Face ID / Touch ID) with refresh-token reuse
  - Multi-language UI matching web app's locale bundle
  - iOS 15+ and Android 9+ (API 28) minimum
- **Real-time GPS** via Socket.io rooms per tenant
  - `tenant-<orgId>` room for tenant-scoped events
  - `user-<userId>` room for personal events
  - `gps.update`, `geofence.enter`, `geofence.exit`,
    `workorder.assigned`, `alert.critical` events
  - Socket.io Redis adapter for cross-pod scaling
- **Geofence engine**
  - Circle + polygon geofences
  - 2dsphere index on `Vehicle.currentLocation`
  - `$geoWithin` queries on every GPS ping
  - Alert fan-out via Socket.io + push notification
- **Live map dashboard**
  - Leaflet / Mapbox with vehicle markers
  - Clustering for large fleets
  - Filter by status / branch / type
  - Vehicle detail panel on click
- **MFA enrollment flow** (TOTP) — completes the Phase 1 scaffolding
- **Field-level encryption** for PII (`nationalId`, `licenseNumber`,
  `mfa.secret`, `FuelCard.cardNumber`)
- **BullMQ + Redis** for background jobs (notifications, reports)
- **Per-tenant CORS allowlist** for custom domains
- **S3-compatible file storage** with presigned URLs (replaces local
  `/uploads`)
- **Distributed rate limiting** via Redis (`rate-limit-redis`)

### Dependencies
- Phase 1 complete (DONE).
- APNs / FCM accounts provisioned.
- Mapbox / Google Maps API key.
- Redis managed service (Elasticache / Upstash).
- S3 bucket + IAM user.

### Team required
| Role | FTE |
|---|---|
| Mobile engineer (React Native) | 2 |
| Backend engineer (Socket.io, BullMQ, S3) | 1.5 |
| Frontend engineer (live map dashboard) | 1 |
| DevOps engineer (Redis, APNs/FCM, Mapbox) | 0.5 |
| QA engineer (mobile + real-time integration) | 1 |
| Tech lead | 0.5 |
| **Total** | **6.5 FTE × 3 months = 19.5 FTE-months** |

### Estimated effort
- ~780 person-days.

### Closure criteria
1. Mobile app published to App Store + Play Store (TestFlight + internal
   test track acceptable for early access).
2. Real-time GPS updates delivered to dashboard < 2 s end-to-end.
3. Geofence breach alerts received by assigned fleet managers < 5 s
   after the event.
4. MFA TOTP enrollment + login challenge works end-to-end.
5. Offline mode: 100 mutations queued locally, replayed on reconnect
   with no data loss.
6. Background GPS capture runs for 8 hours on a single charge
   (with platform battery optimizations).

---

## Phase 3 — AI/ML + Integrations (Months 7-12)

**Theme:** Build the AI/ML layer that differentiates VeloManage from
legacy incumbents, plus the integrations that make it stick.

### Deliverables (6 months)

#### Month 7-8: Maintenance + Fuel AI
- **Maintenance prediction** — LSTM time-series model on telematics +
  work-order history; forecasts component failure 7–30 days ahead.
- **Fuel anomaly detection** — Isolation Forest on per-vehicle fuel
  transactions; flags theft / skimming with anomaly score.
- Python inference service (`ai/` — new directory) exposing `/predict`
  endpoints; called by BullMQ workers.

#### Month 9: Driver + Demand AI
- **Driver behavior scoring** — gradient-boosting model on harsh-brake,
  harsh-accel, idle, overspeed events; weekly score per driver.
- **Demand forecasting** — Prophet on per-route trip volume; informs
  dispatch capacity planning.

#### Month 10-11: Scheduling + Optimization
- **Smart scheduling** — Google OR-Tools constraint solver for vehicle +
  driver + maintenance scheduling.
- **Route optimization** — graph-based shortest-path with live traffic
  (GraphHopper / OSRM).

#### Month 11-12: AI Assistant + OCR
- **Predictive procurement** — regression on parts consumption; auto-suggest
  PO quantities.
- **Document OCR & classification** — extract VIN, license, registration
  data from uploaded documents (Tesseract / cloud OCR).
- **AI assistant** — LLM with RAG over fleet data; natural-language
  queries ("which vehicles are due for service next week?") and report
  generation.

#### Cross-cutting integrations (Months 7-12)
- Telematics provider SDKs (Geotab, Samsara, Motive — read-only adapters)
- Fuel card provider APIs (WEX, FleetCor — for transaction import)
- Accounting integrations (QuickBooks Online, Xero — for finance export)
- IdP integrations (Okta, Azure AD, Google Workspace — for SSO)

### Dependencies
- Phase 2 complete (real-time GPS feeds the AI models).
- Labeled training data: 12 months of historical data per pilot customer
  (minimum 3 pilot customers).
- Python ML stack: scikit-learn, TensorFlow, Prophet, OR-Tools.
- GPU instance for model training (or managed Vertex AI / SageMaker).
- LLM API access (OpenAI / Anthropic / self-hosted via vLLM).
- Telematics provider API keys (per pilot customer).

### Team required
| Role | FTE |
|---|---|
| ML engineer | 2 |
| Backend engineer (integration, BullMQ) | 1.5 |
| Data engineer (pipelines, feature store) | 1 |
| Frontend engineer (AI assistant UI, prediction panels) | 1 |
| DevOps engineer (GPU, model serving, monitoring) | 0.5 |
| QA engineer | 0.5 |
| Tech lead | 0.5 |
| **Total** | **7 FTE × 6 months = 42 FTE-months** |

### Estimated effort
- ~1680 person-days.

### Closure criteria
1. Maintenance prediction achieves precision ≥ 0.75 and recall ≥ 0.60
   on the held-out test set per pilot customer.
2. Fuel anomaly detection flags > 80 % of confirmed theft cases
   (per pilot customer).
3. AI assistant answers natural-language fleet queries with ≥ 90 %
   factuality on a benchmark suite.
4. Telematics import syncs ≥ 95 % of GPS pings from at least one
   provider without manual intervention.
5. All AI predictions visible in the UI with explainability
   (feature attribution) and a "feedback" button.

---

## Phase 4 — Scale + Compliance (Months 13-18)

**Theme:** Take VeloManage to enterprise scale and compliance readiness.

### Deliverables (6 months)

#### Month 13-14: Sharding + GraphQL
- **MongoDB sharding** — shard Vehicle, Trip, FuelTransaction, AuditLog
  by `{ organizationId: "hashed", _id: 1 }` once collections exceed
  10 M documents. Pre-split for known large tenants.
- **GraphQL gateway** — Apollo Server in front of the REST API; supports
  dashboard-optimized queries and mobile app queries with one round-trip.
- **Time-based partitioning** for audit logs and fuel transactions via
  zone sharding; cold tier moves > 90-day data to Atlas Online Archive.

#### Month 15-16: Webhooks + SDKs
- **Webhooks framework** — full event delivery with signature
  verification, retry policy, delivery logs, auto-disable on failure.
- **Public SDKs** — TypeScript, Python, Go (auto-generated from OpenAPI
  spec); published to npm / PyPI / GitHub packages.
- **OpenAPI/Swagger** — full spec at `/api/v1/openapi.json`; Swagger UI
  at `/docs`; ReDoc at `/redoc`. 100 % route coverage.

#### Month 17-18: Compliance + Enterprise
- **SOC2 Type II audit** — auditor engagement; evidence collected via
  audit log + observability stack; report issued by end of Phase 4.
- **GDPR DPA templates** — `docs/legal/DPA.md` published; sub-processor
  list maintained; customer-facing privacy portal.
- **SSO / SAML for enterprise** — Okta, Azure AD, Google Workspace
  integrations; SAML attribute mapping to VeloManage roles.
- **RS256 JWT signing** — separate key pair for signing vs verification
  (key rotation without invalidating all sessions).
- **cosign image signing** — all container images signed; verified at
  deploy time via K8s admission policy.
- **Penetration test** — third-party pen test; findings remediated.
- **Bug bounty program** — launched via HackerOne.
- **Multi-region deployment** — active-passive in two regions; cross-
  region backup replication.

### Dependencies
- Phase 3 complete (predictive models stable).
- MongoDB Atlas sharded cluster (M30+ per shard).
- Apollo Server license / self-hosted.
- openapi-generator toolchain.
- SOC2 auditor engagement (e.g. Vanta + external auditor).
- SAML test IdPs (Okta dev tenant).
- HackerOne program setup.

### Team required
| Role | FTE |
|---|---|
| Backend engineer (GraphQL, sharding, webhooks, SDKs) | 2 |
| DevOps engineer (multi-region, cosign, K8s admission) | 1.5 |
| Security engineer (SOC2, SAML, pen test coordination) | 1 |
| Tech lead / architect | 0.5 |
| QA engineer | 0.5 |
| Compliance consultant (SOC2, GDPR) | 0.5 (contract) |
| **Total** | **6 FTE × 6 months = 36 FTE-months** |

### Estimated effort
- ~1440 person-days.

### Closure criteria
1. Sharded cluster serves 10 M+ Vehicle documents with p95 query
   latency < 300 ms.
2. GraphQL gateway supports the same query coverage as REST with
   < 5 % error rate.
3. SOC2 Type II report issued with no material exceptions.
4. Three enterprise customers live on SSO/SAML with their IdP.
5. Public SDKs downloaded > 1000 times in first month.
6. Pen test report shows no critical or high findings open.

---

## Cross-Phase: Continuous Engineering

Throughout all phases:
- **Bug bash** every 2 weeks; bugs triaged within 48 hours.
- **Dependency update PR** weekly via Dependabot.
- **On-call rotation** starts in Phase 2 (PagerDuty); 24/7 from Phase 4.
- **Customer feedback loop**: product manager reviews NPS + support
  tickets weekly; quarterly roadmap adjustment.

---

## Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Incumbent (Samsara, Geotab) bundles hardware at zero margin, undercutting price | High | High | Stay hardware-agnostic; compete on UX, AI, and breadth; do not engage in price war with subsidised hardware |
| 2 | MongoDB scaling bottleneck before sharding is in place | Medium | High | Shard by month 13 at the latest; monitor collection growth weekly; pre-shard Vehicle + AuditLog at 5 M docs |
| 3 | AI models fail to generalize across customers (low precision/recall) | Medium | Medium | Run pilot with 3+ customers in Phase 3; require minimum 12 months historical data; ship with explainability + feedback loop |
| 4 | SOC2 audit slips beyond Phase 4 due to evidence gaps | Medium | High | Start evidence collection in Phase 2 (audit log, observability); engage auditor at start of Phase 4; mock audit in month 16 |
| 5 | Mobile app rejected by App Store / Play Store | Low | High | Engage with Apple/Google early; follow platform guidelines from day 1; TestFlight + internal test track from Phase 2 |

---

## Summary Table

| Phase | Months | Theme | FTE-months | Key risk |
|---|---|---|---|---|
| 1 | 1-3 | Foundation | 13.5 | Delivered — risk retired |
| 2 | 4-6 | Mobile + Real-time | 19.5 | Mobile + GPS battery/perf |
| 3 | 7-12 | AI/ML + Integrations | 42 | Model generalization |
| 4 | 13-18 | Scale + Compliance | 36 | SOC2 timing |
| **Total** | **18** | | **111 FTE-months** | |

Total team peak: ~7 FTE during Phase 3.
