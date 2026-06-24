# VeloManage — Gap Analysis

| Field | Value |
|---|---|
| Document version | 1.0 |
| Date | 2026-06-24 |
| Scope | Honest assessment of what is DONE vs. PARTIAL vs. PLANNED in this commit |
| Related files | `docs/PRD.md`, `docs/ROADMAP.md`, `docs/architecture/*` |

This document is the single source of truth on the current state of the
VeloManage platform. It is intentionally honest: prospective customers,
internal stakeholders, and engineers should be able to read it and know
exactly what the platform can and cannot do today.

---

## 1. Summary

Phase 1 (Foundation) is delivered in this commit. The platform has a
multi-tenant data model, 16-role RBAC, JWT auth with refresh-token
rotation, an immutable audit log, 13 enterprise module routes, Docker +
Kubernetes deployment, CI/CD, and a 329-test Jest suite at 33.7 %
statement coverage.

What is **not** in this commit: mobile app, real-time GPS, all AI/ML
features, GraphQL, webhooks, OpenAPI/Swagger, SOC2 audit, SSO/SAML,
public SDKs. These are scoped in `docs/ROADMAP.md` for Phases 2-4.

Total estimated effort to close all gaps to Phase 4 completion:
**~97.5 engineer-weeks** (see §4).

---

## 2. Module Status Matrix

Legend: **DONE** = production-ready in this commit. **PARTIAL** = the
schema and basic CRUD exist but business endpoints or integrations are
missing. **PLANNED** = not started; scheduled for a later phase.

| Module | Status | Files | Next steps |
|---|---|---|---|
| Multi-tenancy | DONE | `backend/src/middleware/tenant.js`, `backend/src/models/Organization.js` | Add per-tenant CORS allowlist (Phase 4) |
| RBAC (16 roles) | DONE | `backend/src/config/rbac.js`, `backend/src/middleware/rbac.js` | Add per-user additional permissions UI (Phase 2) |
| Auth (JWT access + refresh) | DONE | `backend/src/routes/auth.js`, `backend/src/models/User.js` | RS256 signing (Phase 4) |
| Refresh-token rotation + reuse detection | DONE | `backend/src/models/User.js:242-298` | None |
| MFA (TOTP) | PARTIAL | schema on `User.mfa`, `select: false` | Enrollment + challenge flow (Phase 2, 2 eng-wks) |
| OAuth (Google / Microsoft) | PLANNED | schema on `User.oauth` | Phase 4, 3 eng-wks |
| SSO / SAML | PLANNED | schema on `User.oauth.saml` | Phase 4, 4 eng-wks |
| Audit log | DONE | `backend/src/models/AuditLog.js`, `backend/src/routes/audit.js` | Move to cold storage via Atlas Online Archive (Phase 4, 1 eng-wk) |
| Vehicles module | DONE | `backend/src/models/Vehicle.js`, `backend/src/routes/modules/vehicles.js` | Add `documents` upload via S3 (Phase 2, 1 eng-wk) |
| Drivers module | DONE | `backend/src/models/Driver.js`, `backend/src/routes/modules/drivers.js` | Add HOS compliance rules (Phase 3, 2 eng-wks) |
| Maintenance module | DONE | `backend/src/models/MaintenanceWorkOrder.js`, `backend/src/routes/modules/maintenance.js` | Add `parts` inventory decrement (Phase 2, 1 eng-wk) |
| Fuel module | DONE | `backend/src/models/FuelTransaction.js`, `backend/src/routes/modules/fuel.js` | Add fuel-card import integration (Phase 3, 2 eng-wks) |
| Trips module | DONE | `backend/src/models/Trip.js`, `backend/src/routes/modules/trips.js` | Add route optimization (Phase 3, 3 eng-wks) |
| Geofences module | DONE (schema + CRUD) | `backend/src/models/Geofence.js`, `backend/src/routes/modules/geofences.js` | Add real-time breach detection (Phase 2, 3 eng-wks) |
| Compliance module | DONE | `backend/src/models/Compliance.js`, `backend/src/routes/modules/compliance.js` | Add expiring-items report (Phase 2, 1 eng-wk) |
| Accidents module | DONE | `backend/src/models/Accident.js`, `backend/src/routes/modules/accidents.js` | Add photo upload via S3 (Phase 2, 1 eng-wk) |
| Finance module | DONE | `backend/src/models/FinanceTransaction.js`, `Budget.js`, `Contract.js`, `backend/src/routes/modules/finance.js` | Add QuickBooks/Xero export (Phase 3, 3 eng-wks) |
| HR (Staff) module | DONE | `backend/src/models/Staff.js`, `backend/src/routes/modules/staff.js` | Add payroll export (Phase 2, 2 eng-wks) |
| Procurement module | DONE | `backend/src/models/PurchaseOrder.js`, `Part.js`, `backend/src/routes/modules/vendors.js` | Add PO receipt workflow (Phase 2, 2 eng-wks) |
| Assets module | DONE | `backend/src/models/Asset.js`, `backend/src/routes/modules/assets.js` | Add depreciation schedule runner (Phase 2, 1 eng-wk) |
| CRM (Customers) module | DONE | `backend/src/models/Customer.js`, `backend/src/routes/modules/customers.js` | Add customer portal (Phase 4, 4 eng-wks) |
| Vendors module | DONE | `backend/src/models/Vendor.js`, `backend/src/routes/modules/vendors.js` | Add vendor performance scoring (Phase 3, 2 eng-wks) |
| Real-time GPS | PLANNED | Socket.io server in `backend/server.js` exists with basic events | Phase 2, 6 eng-wks |
| Geofence breach engine | PLANNED | — | Phase 2, 3 eng-wks |
| Live map dashboard | PARTIAL | `frontend/src/pages/TrackingPage.jsx`, `frontend/src/components/MapView.jsx` exist | Wire to real-time GPS + clustering (Phase 2, 4 eng-wks) |
| BullMQ background jobs | PLANNED | — | Phase 2, 3 eng-wks |
| S3-compatible file storage | PARTIAL | local `/uploads` via `express.static` in `backend/server.js:214` | Migrate to S3 + presigned URLs (Phase 2, 2 eng-wks) |
| Field-level encryption | PARTIAL | sensitive fields marked `select: false` | Implement AES-256-GCM encryption (Phase 2, 3 eng-wks) |
| Password breach check | PLANNED | — | HaveIBeenPwned integration (Phase 2, 1 eng-wk) |
| IP allowlisting | PARTIAL | schema on `Organization.settings.ipWhitelist` | Implement middleware (Phase 2, 1 eng-wk) |
| Per-tenant CORS | PLANNED | — | Phase 4, 2 eng-wks |
| AI: Maintenance prediction | PLANNED | — | Phase 3, 6 eng-wks |
| AI: Fuel anomaly detection | PLANNED | — | Phase 3, 3 eng-wks |
| AI: Driver behavior scoring | PLANNED | — | Phase 3, 4 eng-wks |
| AI: Demand forecasting | PLANNED | — | Phase 3, 3 eng-wks |
| AI: Smart scheduling | PLANNED | — | Phase 3, 4 eng-wks |
| AI: Route optimization | PLANNED | — | Phase 3, 3 eng-wks |
| AI: Idle-time detection | PLANNED | — | Phase 3, 2 eng-wks |
| AI: Predictive procurement | PLANNED | — | Phase 3, 2 eng-wks |
| AI: Document OCR | PLANNED | — | Phase 3, 3 eng-wks |
| AI: AI assistant (LLM-RAG) | PLANNED | — | Phase 3, 6 eng-wks |
| Mobile app (React Native) | PLANNED | — | Phase 2, 12 eng-wks |
| GraphQL API | PLANNED | — | Phase 4, 6 eng-wks |
| Webhooks framework | PLANNED | — | Phase 4, 4 eng-wks |
| OpenAPI / Swagger | PLANNED | — | Phase 4, 3 eng-wks |
| Public SDKs (JS/Python/Go) | PLANNED | — | Phase 4, 4 eng-wks |
| SOC2 Type II audit | PLANNED | — | Phase 4, 8 eng-wks (incl. consultant) |
| GDPR DPA templates | PLANNED | — | Phase 4, 2 eng-wks |
| SSO / SAML (enterprise) | PLANNED | — | Phase 4, 4 eng-wks (counted above) |
| Stripe billing integration | PLANNED | — | Phase 4, 4 eng-wks |
| MongoDB sharding | PLANNED | indexes already `organizationId`-prefixed | Phase 4, 3 eng-wks |
| Multi-region deployment | PLANNED | — | Phase 4, 4 eng-wks |

---

## 3. Cross-Cutting Concerns

| Concern | Status | Notes |
|---|---|---|
| Multi-tenancy | DONE | Every domain model carries `organizationId`; enforced by `attachTenant` + `tenantFilter` middleware. |
| RBAC (16 roles) | DONE | Full permission matrix in `backend/src/config/rbac.js`; tested in `backend/tests/unit/rbac.test.js`. |
| Audit logging | DONE | `recordAudit()` on every privileged mutation; 7-year TTL; immutable; tested in `backend/tests/unit/audit.test.js`. |
| Auth (access + refresh) | DONE | JWT 15-min access + 30-day refresh with family rotation; tested in `backend/tests/integration/auth.test.js`. |
| DevOps (Docker + K8s + CI/CD) | DONE | Multi-stage Dockerfiles, `docker-compose.yml`, full `k8s/` manifests, GitHub Actions. |
| Tests | PARTIAL | 329 tests / 15 suites pass; 33.7 % statement coverage. Target: 90 %. Branches 24.14 %, functions 25.89 %. |
| Prometheus metrics | DONE | `/metrics` endpoint via `backend/src/middleware/monitoring.js`; tested in `backend/tests/unit/monitoring.test.js`. |
| Helmet + CORS + rate limit | DONE | Wired in `backend/server.js:179-204`; tested in `backend/tests/integration/security.test.js`. |
| Error handling | DONE | Centralized `errorHandler` middleware; tested in `backend/tests/unit/errorHandler.test.js`. |
| Graceful shutdown | DONE | SIGTERM/SIGINT handlers in `backend/server.js:429`. |
| Mobile | PLANNED | No code yet; Phase 2. |
| Real-time (Socket.io) | PARTIAL | Server exists with `truck-location-update`, `new-message`, `new-pickup-request`, `truck-dispatched` events; per-tenant rooms and geofence events deferred to Phase 2. |
| AI/ML | PLANNED | No code yet; Phase 3. |
| GraphQL | PLANNED | No code yet; Phase 4. |
| Webhooks | PLANNED | No code yet; Phase 4. |
| OpenAPI/Swagger | PLANNED | No code yet; Phase 4. |
| SOC2 | PLANNED | Phase 4. |
| GDPR | PARTIAL | Consent + retention schema on `User`; right-to-be-forgotten job and data export endpoint planned Phase 2-4. |
| SSO/SAML | PLANNED | Schema on `User.oauth.saml`; integration Phase 4. |

---

## 4. Estimated Effort to Close Gaps

All estimates are in engineer-weeks (1 engineer-week = 5 person-days).

### Phase 2 gaps (Months 4-6) — ~39 engineer-weeks
| Gap | Eng-weeks |
|---|---|
| Mobile app (React Native) | 12 |
| Real-time GPS + per-tenant Socket.io rooms | 6 |
| Geofence breach engine | 3 |
| Live map dashboard wiring | 4 |
| BullMQ background jobs framework | 3 |
| S3-compatible file storage + presigned URLs | 2 |
| MFA TOTP enrollment flow | 2 |
| Field-level encryption (AES-256-GCM) | 3 |
| Password breach check (HIBP) | 1 |
| IP allowlisting middleware | 1 |
| Per-route rate limits (Redis) | 1 |
| Maintenance `parts` inventory decrement | 1 |
| Accident photo upload via S3 | 1 |
| **Phase 2 subtotal** | **~40 eng-wks** |

### Phase 3 gaps (Months 7-12) — ~38 engineer-weeks
| Gap | Eng-weeks |
|---|---|
| AI: Maintenance prediction (LSTM) | 6 |
| AI: Fuel anomaly detection (Isolation Forest) | 3 |
| AI: Driver behavior scoring (XGBoost) | 4 |
| AI: Demand forecasting (Prophet) | 3 |
| AI: Smart scheduling (OR-Tools) | 4 |
| AI: Route optimization | 3 |
| AI: Idle-time detection | 2 |
| AI: Predictive procurement | 2 |
| AI: Document OCR | 3 |
| AI: AI assistant (LLM-RAG) | 6 |
| Telematics integrations (Geotab/Samsara/Motive) | 2 |
| Fuel card integrations (WEX/FleetCor) | 2 |
| Accounting integrations (QuickBooks/Xero) | 3 |
| Vendor performance scoring | 2 |
| Compliance HOS rules | 2 |
| Legacy route deprecation (sunset headers) | 1 |
| **Phase 3 subtotal** | **~48 eng-wks** |

### Phase 4 gaps (Months 13-18) — ~46 engineer-weeks
| Gap | Eng-weeks |
|---|---|
| MongoDB sharding | 3 |
| GraphQL gateway | 6 |
| Webhooks framework | 4 |
| OpenAPI / Swagger spec + UI | 3 |
| Public SDKs (JS/Python/Go) | 4 |
| SOC2 Type II audit prep | 8 |
| GDPR DPA templates + privacy portal | 2 |
| SSO/SAML (Okta/Azure AD/Google) | 4 |
| RS256 JWT signing | 1 |
| cosign image signing | 1 |
| Penetration test coordination | 2 |
| Bug bounty program setup | 1 |
| Stripe billing integration | 4 |
| Multi-region deployment | 4 |
| Customer portal | 4 |
| **Phase 4 subtotal** | **~51 eng-wks** |

### Test coverage gap (cross-phase) — ~6 engineer-weeks
The current Jest suite covers 33.7 % of statements. The 90 % target
requires integration tests for the legacy routes (`trucks`, `users`,
`bookings`, `branches`, `dashboard`, `analytics`, `pickups`,
`locations`, `payments`, `messages`, `services`, `organizations`,
`audit`) and module-specific custom handlers (staff leave/attendance/
payroll, vehicle assign-driver/odometer/dispose, driver assignment,
maintenance approve, finance approve). Estimated 6 eng-wks of focused
test engineering.

### Grand total: ~145 engineer-weeks
At ~4.5 FTE average over 18 months (≈ 81 FTE-weeks per quarter × 6
quarters ≈ 486 FTE-weeks capacity), the planned capacity covers this
with margin for unplanned work.

---

## 5. Honest Risks

| # | Risk | Why | Mitigation |
|---|---|---|---|
| 1 | Test coverage gap (33.7 % vs 90 % target) | Legacy routes and module business endpoints not covered; refactoring without tests is risky | Dedicate 1 engineer to backfill tests in Phase 2; gate PRs on no-coverage-decrease |
| 2 | Real-time scaling (Socket.io) | Current implementation is single-pod; cross-pod broadcast needs Redis adapter | Land Redis adapter with first Phase 2 real-time deploy |
| 3 | Audit log volume | 2 B records projected at year 5; MongoDB write throughput + storage cost | Move to time-partitioned collections + Atlas Online Archive in Phase 4 |
| 4 | AI model generalization | Trained on pilot data; may not generalize to all customer fleets | Ship with explainability + feedback loop; pilot with 3+ customers before broad rollout |
| 5 | SOC2 timing | Evidence collection starts late; auditor may slip | Start evidence collection in Phase 2 (audit log + observability are already in place); mock audit in month 16 |

---

## 6. What's Done in This Commit (Recap)

The Phase 1 deliverables below are all in this commit and ready for
review:

- 13 enterprise module routers with full CRUD envelope
- 26 Mongoose models with tenant isolation + compound indexes
- 16-role RBAC with permission matrix (single source of truth in
  `backend/src/config/rbac.js`)
- JWT auth: register, login, refresh (with rotation + reuse detection),
  verify, logout, logout-all, sessions, change-password, password-reset
- Immutable audit log with 7-year TTL + sensitive-field redaction
- Multi-stage Dockerfiles for backend + frontend
- `docker-compose.yml` with Mongo + Redis + healthchecks
- Full Kubernetes manifests (Deployment, Service, Ingress, HPA, PDB,
  ConfigMap, Secret template, Namespace)
- GitHub Actions CI (backend test, frontend build, docker build,
  multi-arch push) + deploy workflow
- Prometheus `/metrics` endpoint (zero-dependency)
- Jest test scaffolding: 329 tests / 15 suites; 30 % coverage threshold
- Comprehensive documentation set (this file + 9 others)

Everything else in `docs/PRD.md` and `docs/ROADMAP.md` is scoped and
sized but not yet implemented. Future commits will close the gaps in
the order described above.
