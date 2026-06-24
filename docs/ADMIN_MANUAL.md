# VeloManage — Admin Manual

| Field | Value |
|---|---|
| Document version | 1.0 |
| Audience | Platform admins (`super_admin`, `platform_owner`), organization owners (`company_owner`), SRE / DevOps on-call |
| Related files | `docs/SECURITY.md`, `docs/architecture/DEPLOYMENT.md`, `backend/src/routes/{organizations,audit}.js`, `k8s/*` |

This manual covers platform-level administration: organization management,
audit log review, backup & restore, monitoring, incident response, and
disaster recovery. For end-user workflows (drivers, mechanics, etc.), see
`docs/USER_MANUAL.md`.

---

## 1. Platform Admin

The `super_admin` and `platform_owner` roles have global access across all
tenants via the wildcard `*` permission. They are the only roles that can
manage the `Organization` collection at the platform level.

### 1.1 Manage organizations
1. Go to **Platform → Organizations**.
2. The list shows all organizations with plan, status, vehicle count,
   user count, last activity.
3. Filter by plan (`free` / `starter` / `business` / `enterprise` /
   `government`), status (`trialing` / `active` / `past_due` / `canceled`
   / `suspended`), country, industry.
4. Click an organization to see details: branding, limits, settings,
   hierarchy (parent + subsidiaries).

### 1.2 Suspend an organization
Use when a customer is past due on payment or under investigation.
1. Open the organization.
2. Click **Suspend**.
3. Choose a reason (e.g. "Payment failure", "Abuse investigation").
4. Confirm.
5. Effects:
   - `Organization.isActive = false`, `suspendedAt = now`,
     `suspensionReason` set.
   - All subsequent API requests from users in that organization return
     403 with message "Organization is suspended or inactive."
   - All active refresh tokens for users in that organization are
     revoked.
   - An audit log entry with `severity: critical` is written.
6. The organization owner receives an email notification.

### 1.3 Reactivate an organization
1. Open the suspended organization.
2. Click **Reactivate**.
3. Confirm. `isActive = true`, `suspendedAt` cleared.
4. Users must log in again (refresh tokens were revoked at suspension).

### 1.4 Manage plan limits
1. Open the organization.
2. Click **Edit limits**.
3. Adjust `maxUsers`, `maxVehicles`, `maxBranches`, `maxStorageMb`.
4. Click **Save**. The change takes effect immediately — signups and
   vehicle creation will be rejected past the new limit.
5. Use `-1` for unlimited (enterprise contracts).

### 1.5 Act in a tenant context
Platform admins can act within a specific tenant's context using the
`x-organization-id` header:
```
GET /api/v1/vehicles
X-Organization-Id: 507f1f77bcf86cd799439011
Authorization: Bearer <super_admin token>
```
This sets `req.tenantId` so the request returns only that organization's
vehicles — useful for customer support. The action is logged in the
audit log with the super_admin's identity.

---

## 2. Organization Owner

The `company_owner` role is the top-level admin within a single tenant.

### 2.1 Manage users
- Invite users, assign roles, deactivate, reactivate.
- See `USER_MANUAL.md` §2.1-2.2 for the standard flow.
- Cannot create `super_admin` or `platform_owner` roles — those are
  platform-level only.

### 2.2 Manage billing
1. Go to **Settings → Billing** (Phase 4 — Stripe integration).
2. View current plan, next renewal date, payment method.
3. Upgrade / downgrade plan.
4. View past invoices.
5. Update payment method.

In Phase 1, billing is managed out-of-band (manual invoicing); the
`Organization.plan` and `Organization.planStatus` fields are updated by
platform admins.

### 2.3 Manage branches
See `USER_MANUAL.md` §2.3.

### 2.4 Manage roles & permissions
1. Go to **Admin → Roles**.
2. The page lists all 16 roles with their default permission grants
   (read-only — the matrix is the single source of truth in
   `backend/src/config/rbac.js`).
3. Per-user additional permissions (`User.permissions[]`) can be added
   on a user's edit page — useful for granting a specific user a single
   permission outside their role.

---

## 3. Audit Log Review

The audit log is the system of record for compliance (SOC2, GDPR) and
internal investigations.

### 3.1 Access
- `audit:read` permission required (granted to `company_owner`,
  `auditor`, `super_admin`, `platform_owner`).
- Go to **Audit → Log** in the UI, or call
  `GET /api/v1/audit?...`.

### 3.2 Filter
| Filter | Query parameter | Example |
|---|---|---|
| User | `userId` | `?userId=507f1f77bcf86cd799439011` |
| Action | `action` | `?action=vehicle.create` |
| Category | `category` | `?category=finance` |
| Severity | `severity` | `?severity=critical` |
| Status | `status` | `?status=denied` |
| Date range | `from`, `to` | `?from=2026-01-01&to=2026-06-30` |
| Resource | `resourceType`, `resourceId` | `?resourceType=Vehicle&resourceId=...` |
| Organization | `organizationId` | `?organizationId=...` (super_admin only) |

Combine filters with `&` for AND semantics.

### 3.3 Export
- `GET /api/v1/audit/export?...&format=csv` returns a CSV file.
- `GET /api/v1/audit/export?...&format=json` returns JSON.
- Max 100,000 rows per export; for larger exports, schedule a report
  via `POST /api/v1/audit/export/async` (Phase 4 — generates S3 link).

### 3.4 Investigate
For incident investigation:
1. Start with the `severity = critical` or `status = denied` filter
   for the time window of the incident.
2. Note the `traceId` of suspicious entries.
3. Cross-reference with:
   - `GET /api/v1/auth/sessions?userId=...` (active sessions)
   - `GET /api/v1/users/:id` (login history)
   - Application logs (filter by `traceId` in Loki / Kibana)
4. If you confirm a compromise, follow the incident response runbook
   (§6 below).

### 3.5 Retention
- Audit log entries are retained for 7 years (2555 days) via a TTL
  index on `timestamp`.
- Records > 90 days are moved to cold storage (Atlas Online Archive,
  Phase 4) but remain queryable.
- For longer retention (regulated industries), set
  `Organization.settings.dataRetentionDays` to a higher value.

---

## 4. Backup & Restore Procedures

### 4.1 Backup layers
| Layer | Mechanism | Frequency | Retention |
|---|---|---|---|
| Continuous | Atlas PITR | continuous | 7 days |
| Snapshot | Atlas scheduled | daily 02:00 UTC | 30 days |
| Logical dump | `mongodump` via K8s CronJob | daily 03:00 UTC | 14 days in S3 |
| Pre-deploy | Atlas on-demand snapshot | before each deploy | 7 days |
| Cross-region | Atlas backup copy | daily | 30 days |

### 4.2 Restore a single collection (logical dump)
Use this for accidental deletion of a small set of documents.

```bash
# 1. Download the latest dump from S3
aws s3 cp s3://velomanage-mongodump/$(date -u +%Y-%m-%d)/velomanage.tar.gz .

# 2. Extract
tar -xzf velomanage.tar.gz

# 3. Restore one collection to a staging cluster
mongorestore --host staging.mongodb.example \
  --username restore-user --password "$MONGO_PWD" \
  --nsInclude="velomanage.vehicles" \
  --dir=velomanage/

# 4. Inspect in staging, then export the specific documents
mongoexport --host staging.mongodb.example \
  --username ... --password ... \
  --db=velomanage --collection=vehicles \
  --query='{"vehicleId": "TRK-001"}' \
  --out=/tmp/vehicles.json

# 5. Import to production
mongoimport --host prod.mongodb.example \
  --username ... --password ... \
  --db=velomanage --collection=vehicles \
  --file=/tmp/vehicles.json
```

### 4.3 Restore to a point in time (Atlas PITR)
Use this for catastrophic data loss or corruption.

```bash
# Atlas UI: select cluster → "Restore" → "Point in Time"
# Choose timestamp (within last 7 days, to the second)
# Choose target: new cluster (recommended) or snapshot-only
# Restore creates a new cluster with the data as of the chosen time

# Once the new cluster is ready, repoint the API:
kubectl edit secret velomanage-secret -n velomanage
# Update MONGODB_URI to the new cluster

kubectl rollout restart deployment/backend -n velomanage
```

### 4.4 Restore testing
- Monthly: restore the latest daily snapshot to staging and run smoke
  tests.
- Quarterly: full DR drill — restore from PITR, switch DNS, run smoke
  tests, switch back.
- Results recorded in `docs/incidents/<date>-dr-drill.md`.

---

## 5. Monitoring Dashboards

### 5.1 Prometheus
- Metrics exposed at `GET /metrics` on every backend pod
  (`backend/src/middleware/monitoring.js`).
- Scrape config (Prometheus):
  ```yaml
  - job_name: 'velomanage-backend'
    kubernetes_sd_configs:
      - role: pod
        namespaces: { names: ['velomanage'] }
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
    metric_relabel_configs:
      - source_labels: [__name__]
        action: drop
        regex: 'nodejs_gc_.*'
  ```

### 5.2 Grafana dashboards
Three pre-built dashboards (JSON in `docs/grafana/` — Phase 2):
1. **API Overview** — request rate, latency p50/p95/p99, error rate,
   in-flight requests, HPA replica count.
2. **Database** — connection pool size, query duration, document reads/
   writes, replica set lag.
3. **Business** — signups per hour, vehicles added per hour, audit log
   write rate, active sessions, geofence breach count.

### 5.3 Key panels to watch
| Panel | Healthy | Action if bad |
|---|---|---|
| `http_requests_total{status=~"5.."}` rate | < 0.1 % of total | Check logs, recent deploy, DB health |
| `http_request_duration_seconds` p95 | < 300 ms | Check slow queries, index usage |
| `db_connections` | < 80 % of maxPoolSize | Scale DB, check for leaks |
| `nodejs_event_loop_lag_seconds` p99 | < 50 ms | Profile blocking calls |
| `http_requests_in_flight` | < 100 per pod | Scale up HPA |
| MongoDB replica set lag | < 10 s | Investigate secondary load |

### 5.4 Alerts
Configured in Alertmanager (`docs/architecture/DEPLOYMENT.md` lists the
rules). Critical alerts page on-call via PagerDuty:
- `VelomanageAPIErrorRate` — error rate > 1 % for 5 min
- `VelomanageAPIUnavailable` — `/health` 503 for 60 s
- `VelomanageDBDisconnected` — `db_connections = 0` for 30 s
- `VelomanageHighLatency` — p95 latency > 1 s for 5 min
- `VelomanagePodCrashLooping` — pod restart count > 3 in 10 min
- `VelomanageAuditLogWriteFailure` — audit log write error rate > 0.1 %

---

## 6. Incident Response Runbook

### 6.1 Severity (recap)
- SEV-1: production outage or confirmed data breach — 15-min response.
- SEV-2: major feature broken or security incident suspected — 1 hour.
- SEV-3: minor feature broken, no security impact — 4 hours.
- SEV-4: cosmetic / docs — next business day.

### 6.2 On-call steps (SEV-1)
1. **Acknowledge** the page in PagerDuty within 15 min.
2. **Assess** scope: which tenants affected? Which features? Use
   `/health`, Grafana, audit log.
3. **Communicate**:
   - Post in `#incidents` Slack channel with severity + scope.
   - Update status page (`status.velomanage.example`).
   - Page additional on-call if needed.
4. **Contain**:
   - If a bad deploy: roll back via `kubectl rollout undo
     deployment/backend -n velomanage`.
   - If a DB issue: failover to secondary (Atlas auto-failover handles
     primary loss; for region loss, see §7).
   - If a security incident: follow §6.3.
5. **Recover**: validate via smoke tests, canary traffic, then full
   traffic.
6. **Resolve**: close the incident in PagerDuty; update status page.
7. **Post-mortem** within 5 business days:
   - Timeline of events
   - Root cause analysis
   - Action items with owners and due dates
   - Published to `docs/incidents/<date>-<slug>.md`

### 6.3 Security incident runbook
1. **Detect** — Alertmanager fires; or customer report via
   `security@velomanage.example`.
2. **Contain**:
   - Suspend affected user accounts (`User.isSuspended = true`).
   - Revoke all refresh tokens for affected users
     (`User.revokeAllRefreshTokens`).
   - If a tenant is compromised: suspend the organization.
   - If a pod is compromised: cordon + drain; snapshot logs.
3. **Investigate**:
   - Filter audit log by `severity = critical` for the affected window.
   - Cross-reference with `auth.login` entries from unexpected geos.
   - Export relevant audit entries to a secure bucket.
4. **Eradicate**:
   - Patch the vulnerability (rollback or hotfix).
   - Rotate credentials: JWT secret, DB password, S3 keys, Stripe key.
   - Force password reset for all affected users.
5. **Notify**:
   - Affected customers within 72 hours (GDPR Art. 33).
   - Regulators if personal data was breached.
6. **Recover**: restore services from last known-good state.
7. **Post-mortem** + tabletop exercise to validate the new controls.

---

## 7. Disaster Recovery Procedures

### 7.1 RTO and RPO
- **RPO** (Recovery Point Objective): 15 minutes — maximum data loss.
- **RTO** (Recovery Time Objective): 4 hours — maximum downtime.

### 7.2 Failure scenarios

#### Scenario A: Single pod crash
- Detection: K8s liveness probe fails.
- Mitigation: K8s restarts the pod automatically; traffic routed to
  other pods via service mesh.
- Expected recovery: < 30 s.

#### Scenario B: MongoDB primary loss
- Detection: Atlas health alert; `db_connections` drops to 0.
- Mitigation: Atlas automatically elects a new primary within 30 s.
- API returns 503 during the election; clients retry.
- Expected recovery: < 1 min.

#### Scenario C: Region loss
- Detection: Cloud provider health dashboard; alert on cross-region
  ping failure.
- Mitigation:
  1. Restore latest PITR snapshot to the secondary region
     (`docs/ADMIN_MANUAL.md` §4.3).
  2. Update DNS to point to the secondary region's load balancer.
  3. Switch K8s context to the secondary region cluster and scale up.
- Expected recovery: < 4 hours.
- Data loss: up to 15 minutes (PITR granularity).

#### Scenario D: Data corruption
- Detection: anomaly in audit log, user reports.
- Mitigation:
  1. Identify the corruption window from the audit log.
  2. Restore PITR snapshot from just before the corruption.
  3. Replay legitimate mutations from the audit log.
- Expected recovery: 2-4 hours depending on volume.

#### Scenario E: Ransomware / malicious deletion
- Detection: spike in `DELETE` operations or audit log `severity:
  critical`.
- Mitigation:
  1. Suspend the responsible user account.
  2. Revoke all refresh tokens.
  3. Restore from PITR snapshot before the malicious activity.
  4. Replay legitimate mutations.
  5. Force password reset for affected users.

### 7.3 DR drill checklist (quarterly)
1. Notify customers of planned DR drill (maintenance window).
2. Simulate region loss: stop primary region's backend deployment.
3. Trigger cross-region restore.
4. Validate via smoke tests.
5. Switch DNS.
6. Run for 1 hour in secondary region.
7. Fail back to primary region.
8. Publish drill report to `docs/incidents/<date>-dr-drill.md`.

---

## 8. Routine Maintenance

### 8.1 Database index rebuilds
- Schedule during low-traffic hours (weekend 02:00 UTC).
- Use `db.collection.createIndex({...}, { background: true })`.
- Monitor progress via `db.currentOp()`.

### 8.2 MongoDB version upgrades
- Atlas handles rolling upgrades with zero downtime.
- Test in staging first; promote to production during a maintenance
  window.

### 8.3 Certificate renewal
- cert-manager auto-renews TLS certificates 30 days before expiry.
- Alert if a certificate is within 7 days of expiry and not yet
  renewed.

### 8.4 Dependency updates
- Dependabot opens PRs weekly.
- Merge after CI passes; deploy during a maintenance window if the
  update is a major version.
- Monthly review of `npm audit` output; remediate high+ severity
  within 7 days.

### 8.5 Storage cleanup
- Daily BullMQ job (Phase 2) cleans:
  - expired refresh tokens
  - expired upload presigned URLs
  - orphaned file uploads (no parent document)
- Monthly: review `Vehicle.documents` for expired registration /
  insurance documents; archive to cold storage.

---

## 9. Customer Support Runbook

### 9.1 Impersonation
- Platform admins can act in a tenant context via the
  `x-organization-id` header — no need for full impersonation.
- For UI impersonation (Phase 4), use **Support → Impersonate** which
  opens a new tab with the target user's session; every action is
  audited with `impersonatedBy` field.

### 9.2 Common customer issues
| Issue | Resolution |
|---|---|
| "Cannot log in" — 401 | Check if user is verified, active, not locked; check audit log for recent failures |
| "Cannot see vehicles" — empty list | Check user's `organizationId`; check `tenantFilter` resolves correctly; check `vehicles:read` permission |
| "Cannot create vehicle" — 403 | Check role has `vehicles:write`; check organization limits |
| "CORS error" in browser | Add customer's domain to `ADDITIONAL_CORS_ORIGINS` |
| "Database disconnected" 503 | Check Atlas status; check IP allowlist (Atlas Network Access); check `MONGODB_URI` secret |
| "Token expired" frequently | Verify client refresh logic; check `JWT_REFRESH_EXPIRES_IN` |

### 9.3 Escalation path
1. Tier 1 (customer support): triage, gather info, attempt known
   resolutions.
2. Tier 2 (engineering on-call): investigate via logs, audit, metrics.
3. Tier 3 (architect / security): for incidents requiring schema or
   architecture changes.
