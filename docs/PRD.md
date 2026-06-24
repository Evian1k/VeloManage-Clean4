# VeloManage — Product Requirements Document

| Field | Value |
|---|---|
| Document version | 1.0 |
| Status | Approved for Phase 1 execution |
| Owner | Product, VeloManage |
| Last updated | 2026-06-24 |
| Related files | `docs/architecture/*`, `docs/ROADMAP.md`, `docs/GAP_ANALYSIS.md` |

---

## 1. Executive Summary

VeloManage is a multi-tenant, cloud-native fleet management platform that unifies
the lifecycle of every asset a vehicle-centric organization owns — the vehicles
themselves, the drivers who operate them, the maintenance work that keeps them
roadworthy, the fuel and energy they consume, the trips they make, the
compliance obligations they fall under, and the financial transactions they
generate. The platform is designed from day one for the operational scale of a
global SaaS: 10 million end users, 1 million vehicles, 200,000 organizations,
across multiple countries, currencies, and languages, with a 99.9 % uptime SLA.

The product consolidates capabilities that today live in fragmented
point-solutions (telematics, fleet CRMs, fuel cards, maintenance CMMS,
compliance trackers, driver apps) into a single tenant-isolated system with a
uniform RBAC model of 16 roles, an immutable audit log, and a future AI/ML
layer for predictive maintenance, anomaly detection, and demand forecasting.

Phase 1 — the foundation layer — is delivered in this commit. It includes the
multi-tenant data model (13 domain modules), the 16-role RBAC matrix, JWT
access/refresh authentication with rotation and MFA scaffolding, the immutable
audit log, the REST API skeleton, Docker / Kubernetes deployment manifests, CI,
and a 329-test Jest suite. Subsequent phases add mobile, real-time GPS,
AI/ML, and scale/compliance work (see `docs/ROADMAP.md`).

---

## 2. Market Analysis

The connected fleet management market is served by several mature vendors.
The table below summarizes the positioning of the four most-cited competitors
relative to VeloManage's planned scope.

| Vendor | Strengths | Gaps / pain points | VeloManage positioning |
|---|---|---|---|
| Samsara | Strong IoT/telematics hardware bundle, video AI, large market share in North America | Hardware-locked, expensive, weak finance/procurement modules, limited multi-currency | Hardware-agnostic; integrates with any ELD/telmatics provider via standard APIs; full finance + procurement in one schema |
| Geotab | Deep telematics, rule-engine, fleet reporting, government contracts | UX dated, add-on model inflates TCO, weak HR/staff module | Modern web UX, native HR/staff + compliance modules, transparent per-vehicle pricing |
| Motive | Driver-facing app, AI dashcam, ELD compliance focus | Narrow scope (trucking only), limited asset/CRM/finance | Covers all vehicle types (truck, trailer, van, bus, heavy equipment, light vehicle), unified CRM + finance |
| Fleetio | Excellent maintenance CMMS, clean UX, strong asset tracking | Telematics via integrations only, weak real-time GPS, no native HR | Native real-time GPS via Socket.io, native HR/staff, single schema for asset + maintenance + finance |

VeloManage's differentiation is **breadth in one schema** (14 functional
modules sharing one tenant-isolated MongoDB), **modern stack** (Node 20, React
+ Vite, React Native, MongoDB sharded), and **transparent pricing** with no
hardware lock-in. The trade-off is that VeloManage is launching against
entrenched incumbents and must out-execute on UX and AI features in Phase 3.

---

## 3. Target Customers

VeloManage targets mid-market to enterprise vehicle operators (50–10,000
vehicles) in the following industries. Each row lists the modules that drive
the buying decision.

| Industry | Primary modules | Why VeloManage |
|---|---|---|
| Logistics & freight | Fleet, Driver, Trip, Fuel, Maintenance, Compliance | Single-pane view of HOS, fuel, and maintenance across mixed fleets |
| Last-mile delivery | Fleet, Driver, Trip, GPS, Geofence, CRM | Real-time dispatch + customer ETA visibility |
| Passenger transport | Fleet, Driver, Trip, Compliance, GPS | Punctuality + route compliance reporting |
| Vehicle rental | Fleet, Asset, CRM, Finance, Compliance | Lifecycle from acquisition to disposal + customer contracts |
| Construction | Asset, Maintenance, Fuel, GPS, Compliance | Heavy-equipment utilization, off-road assets, fuel theft detection |
| Public transport | Fleet, Driver, Trip, Compliance, GPS, CRM | Schedule adherence, passenger incident tracking |
| Government / municipal | Fleet, Compliance, Audit, Finance, Asset | Immutable audit log, SOC2, multi-agency tenant hierarchy |
| Enterprise (mixed) | all 14 modules | Holding-company structure with subsidiaries |

---

## 4. Personas

VeloManage defines seven primary personas. Each maps to one or more of the 16
RBAC roles in `backend/src/config/rbac.js`.

| Persona | Primary role(s) | Top jobs to be done |
|---|---|---|
| Fleet Manager | `fleet_manager`, `regional_manager` | See fleet status, assign drivers, plan maintenance, control fuel cost |
| Operations Manager | `operations_manager`, `dispatcher` | Dispatch trips, monitor live GPS, react to exceptions |
| Driver | `driver` | See assigned trips, log fuel, report accidents, view pay |
| Mechanic | `mechanic` | See work orders, update status, log parts, close work orders |
| Finance Officer | `finance_officer` | Approve budgets, reconcile fuel, run cost-per-km reports |
| Compliance Officer | `compliance_officer` | Track inspections, manage licenses/permits, file reports |
| Auditor | `auditor` | Read-only access to audit log, finance, compliance; export evidence |

Personas inform the default role-permission grants in
`ROLE_PERMISSIONS` (`backend/src/config/rbac.js:37`). The 9 remaining roles
(`super_admin`, `platform_owner`, `company_owner`, `branch_manager`,
`hr_officer`, `customer_support`, `read_only_user`) are secondary personas
used for platform-wide or scoped administration.

---

## 5. Functional Requirements

Requirements are organized by module. Each module corresponds to one
route file under `backend/src/routes/modules/` and at least one model under
`backend/src/models/`. Every module supports the standard CRUD envelope
(`GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`) via the
`createCrudRouter` factory (`backend/src/routes/crudFactory.js`) plus the
business endpoints listed.

### 5.1 Fleet (Vehicles)
- Model: `backend/src/models/Vehicle.js`
- Full vehicle lifecycle: acquisition, registration, assignment, operation,
  maintenance, retirement, disposal.
- Sub-documents: `specifications`, `registration`, `insurance`, `acquisition`
  (purchase/lease/rental/financing), `depreciation` (straight-line / declining
  balance / units-of-production), `telematics`, `currentLocation`,
  `maintenance` summary, `documents`, `events`, `customFields`.
- Business endpoints: `PUT /:id/assign-driver`, `PUT /:id/location`,
  `POST /:id/retire`, `POST /:id/dispose`, `PUT /:id/odometer`,
  `GET /:id/history`.

### 5.2 Driver
- Model: `backend/src/models/Driver.js`
- Driver profile, license, medical, training, hours-of-service, scores.
- Business endpoints: `PUT /:id/assign-vehicle`, `POST /:id/license-renew`,
  `GET /:id/score`.

### 5.3 Maintenance
- Model: `backend/src/models/MaintenanceWorkOrder.js`
- Work orders: planned, breakdown, inspection; parts; labor; status flow
  (`open` → `in_progress` → `on_hold` → `completed` → `closed`).
- Business endpoints: `POST /:id/approve`, `POST /:id/start`,
  `POST /:id/complete`, `POST /:id/parts`, `GET /upcoming`.

### 5.4 Fuel
- Models: `backend/src/models/FuelTransaction.js`, `FuelCard.js`
- Fuel card management, fuel transaction logging, anomaly flags.
- Business endpoints: `GET /analytics/consumption`, `GET /anomalies`,
  `POST /:id/reconcile`.

### 5.5 GPS & Tracking
- Models: `backend/src/models/Geofence.js`, `Vehicle.currentLocation`
- Real-time location, geofence enter/exit, idle detection.
- Business endpoints: `GET /live`, `GET /:id/track`,
  `POST /geofences/:id/test`, `GET /geofences/events`.

### 5.6 Trip
- Model: `backend/src/models/Trip.js`
- Trip planning, dispatch, execution, completion; start/end geocodes;
  distance; duration; driver assignment.
- Business endpoints: `POST /:id/dispatch`, `POST /:id/start`,
  `POST /:id/complete`, `GET /:id/route`.

### 5.7 Compliance
- Model: `backend/src/models/Compliance.js`
- Inspections, licenses, permits, violations, audit-ready evidence.
- Business endpoints: `GET /expiring`, `POST /:id/renew`,
  `GET /report/:period`.

### 5.8 Accident
- Model: `backend/src/models/Accident.js`
- Accident report, involved parties, photos, insurance claim, root cause.
- Business endpoints: `POST /:id/claim`, `POST /:id/photos`,
  `GET /:id/timeline`.

### 5.9 Finance
- Models: `backend/src/models/FinanceTransaction.js`, `Budget.js`,
  `Contract.js`
- Double-entry-lite transactions, budgets, vendor/customer contracts,
  cost-per-km, depreciation posting.
- Business endpoints: `POST /:id/approve`, `GET /reports/pnl`,
  `GET /reports/cost-per-km`, `POST /budgets`.

### 5.10 HR
- Model: `backend/src/models/Staff.js`
- Staff records, leave, attendance, payroll stubs, training.
- Business endpoints: `POST /:id/leave`, `POST /:id/attendance`,
  `GET /:id/payroll`.

### 5.11 Procurement
- Models: `backend/src/models/PurchaseOrder.js`, `Part.js`, `Vendor.js`
- PO → approval → receipt → invoice; parts inventory.
- Business endpoints: `POST /:id/approve`, `POST /:id/receive`,
  `GET /:id/invoice`.

### 5.12 Asset
- Model: `backend/src/models/Asset.js`
- Non-vehicle assets: trailers, containers, equipment; depreciation; assignment.
- Business endpoints: `PUT /:id/assign`, `POST /:id/audit`,
  `GET /:id/depreciation`.

### 5.13 CRM
- Model: `backend/src/models/Customer.js`
- Customer master, contracts, service history, SLA.
- Business endpoints: `GET /:id/contracts`, `GET /:id/jobs`,
  `POST /:id/contact`.

### 5.14 Vendor
- Model: `backend/src/models/Vendor.js`
- Vendor master, performance scoring, contracts, payment terms.
- Business endpoints: `GET /:id/performance`, `POST /:id/contract`,
  `GET /:id/orders`.

### Cross-cutting modules
- `Organization` (`backend/src/models/Organization.js`) — tenant entity;
  carries plan, limits, branding, password policy, IP allowlist, data
  retention.
- `Branch` (`backend/src/models/Branch.js`) — sub-tenant hierarchy.
- `User` (`backend/src/models/User.js`) — authn/authz principal, 16 roles,
  refresh-token family, MFA, login history.
- `AuditLog` (`backend/src/models/AuditLog.js`) — immutable audit trail,
  7-year TTL.
- `Message`, `Booking`, `Location`, `Truck` — legacy compatibility shims.

---

## 6. Non-Functional Requirements

| Attribute | Target | How (current or planned) |
|---|---|---|
| Concurrency | 10 M registered users, 100 K concurrent | Stateless API pods behind HPA (3–20 replicas); Mongo sharding at 10 M+ docs |
| Fleet size | 1 M vehicles | Shard key `organizationId`; compound indexes per tenant |
| Tenant count | 200 K organizations | Tenant isolation via `attachTenant` middleware (`backend/src/middleware/tenant.js`) |
| Geography | Multi-country | `Organization.country`, `currency`, `timezone`, `locale`; i18n bundle in frontend |
| Currency | Multi-currency per org | `currency` field on every monetary sub-document, ISO 4217 |
| Language | English (v1), 5 locales in v2 (en, es, fr, pt, ar) | i18next bundle in `frontend/src/lib/constants.js` |
| Uptime | 99.9 % (≤ 43.8 min/month downtime) | Multi-AZ Kubernetes deployment, graceful shutdown, health/readiness probes |
| API latency | p95 < 300 ms for reads, < 800 ms for writes | Redis cache for hot lookups; paginated list queries use compound indexes |
| Real-time | GPS push latency < 2 s end-to-end | Socket.io rooms per tenant; phased for Phase 2 |
| Security | OWASP Top 10, SOC2 Type II in Phase 4 | See `docs/architecture/SECURITY.md` |
| Auditability | Every privileged mutation logged, 7-year retention | `recordAudit()` in `backend/src/models/AuditLog.js` |
| Availability RTO | 4 hours | Atlas PITR + daily snapshots + mongodump to S3 |
| Availability RPO | 15 minutes | MongoDB Atlas continuous backups |
| Test coverage | 90 % statements | Currently 33.7 %; gap closure in `docs/GAP_ANALYSIS.md` |

---

## 7. AI Features (10)

The AI/ML layer is scheduled for Phase 3. Ten features are scoped:

1. **Maintenance prediction** — LSTM time-series on telematics + work-order
   history to forecast component failure 7–30 days ahead.
2. **Fuel anomaly detection** — Isolation Forest on per-vehicle fuel
   transactions to flag theft or skimming.
3. **Driver behavior scoring** — Gradient-boosting model on harsh-brake,
   harsh-accel, idle, overspeed events; weekly score per driver.
4. **Demand forecasting** — Prophet on per-route trip volume to inform
   dispatch capacity planning.
5. **Smart scheduling** — Google OR-Tools constraint solver for vehicle +
   driver + maintenance scheduling.
6. **Route optimization** — Graph-based shortest-path with live traffic.
7. **Idle-time detection** — Clustering of GPS pings to flag wasteful idling.
8. **Predictive procurement** — Regression on parts consumption to auto-suggest
   PO quantities.
9. **Document OCR & classification** — Extract VIN, license, registration data
   from uploaded documents.
10. **AI assistant** — LLM with RAG over fleet data; natural-language queries
    ("which vehicles are due for service next week?") and report generation.

All AI features expose a uniform inference contract: scheduled BullMQ job →
feature extraction → model server → prediction → notification/report.

---

## 8. Mobile App Requirements

React Native app delivered in Phase 2. Required capabilities:

- Offline-first with a sync engine (queue mutations locally, replay on
  reconnect); conflict resolution by `updatedAt` timestamp.
- Role-tailored UI: Driver (trips, fuel log, accidents, e-sign),
  Mechanic (work orders, parts), Fleet Manager (live map, exceptions).
- Push notifications via APNs + FCM, routed by role and tenant.
- Background GPS capture for Driver role; respects platform battery limits.
- QR/barcode scanning for VIN lookup, parts receipt, fuel-card pairing.
- Biometric login (Face ID / Touch ID) with refresh-token reuse.
- Multi-language UI matching the web app's locale bundle.
- Minimum supported versions: iOS 15+, Android 9+ (API 28).

---

## 9. Success Metrics / KPIs

| Category | KPI | Target (Year 1) |
|---|---|---|
| Adoption | Active organizations | 2,000 |
| Adoption | Active vehicles under management | 100,000 |
| Adoption | MAU (drivers + staff) | 250,000 |
| Engagement | Daily active drivers / total drivers | ≥ 70 % |
| Engagement | % trips with fuel log | ≥ 90 % |
| Operational | API availability | 99.9 % |
| Operational | p95 API latency | < 300 ms |
| Operational | Mean time to recover (MTTR) | < 1 hour |
| Financial | Net revenue retention | ≥ 110 % |
| Financial | Cost per vehicle per month (infra) | ≤ $1.50 |
| Quality | Backend test coverage | ≥ 90 % |
| Quality | Critical defect escape rate | ≤ 0.5 / release |
| Customer | CSAT (post-onboarding) | ≥ 4.3 / 5 |
| Customer | Time-to-first-value (signup → first vehicle added) | ≤ 10 minutes |

---

## 10. Release Roadmap

The roadmap is split into four phases over 18 months. Detailed deliverables,
dependencies, team, and effort are in `docs/ROADMAP.md`.

| Phase | Months | Theme | Headline deliverables |
|---|---|---|---|
| Phase 1 | 1–3 | Foundation | Multi-tenancy, RBAC, audit log, 13 domain models, CRUD routes, Docker, CI/CD, K8s, test scaffolding — **DONE in this commit** |
| Phase 2 | 4–6 | Mobile + Real-time | React Native app, real-time GPS, geofence alerts, live map dashboard |
| Phase 3 | 7–12 | AI/ML + Integrations | 6 ML models (LSTM, Isolation Forest, XGB, Prophet, OR-Tools, LLM-RAG) |
| Phase 4 | 13–18 | Scale + Compliance | Mongo sharding, GraphQL API, webhooks, SOC2 Type II, GDPR DPA, SSO/SAML, public SDKs |

Phase 1 closure criteria (all met in this commit):
1. All 13 module routes respond to standard CRUD with tenant filter.
2. `super_admin`, `company_owner`, `fleet_manager`, `driver`, `mechanic`,
   `finance_officer`, `compliance_officer`, `auditor`, `read_only_user`
   roles exhibit the documented permission matrix
   (`backend/tests/unit/rbac.test.js`).
3. Every privileged mutation writes an `AuditLog` entry.
4. JWT access (15 m) + refresh (30 d) with family-based rotation works
   end-to-end (`backend/tests/integration/auth.test.js`).
5. `docker compose up` brings up backend, frontend, Mongo, Redis with
   healthchecks passing.
6. `kubectl apply -f k8s/` deploys to a target cluster with HPA + PDB +
   Ingress configured.
7. 329 tests pass; coverage threshold enforced at 30 % baseline.

---

## 11. Out of Scope (Phase 1)

Explicitly deferred to later phases:

- Native mobile app (Phase 2)
- Real-time GPS / geofence alerts (Phase 2)
- All 10 AI/ML features (Phase 3)
- GraphQL API (Phase 4)
- Public webhooks framework (Phase 4)
- SOC2 Type II audit (Phase 4)
- Public SDK release (Phase 4)
- Billing/Stripe integration beyond schema (Phase 4)

This scope boundary is documented honestly in `docs/GAP_ANALYSIS.md` so
prospects and internal stakeholders have a single source of truth on what
the platform can and cannot do today.
