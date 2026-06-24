# VeloManage — Database Design

| Field | Value |
|---|---|
| Document version | 1.0 |
| Engine | MongoDB 6.0+ (Atlas recommended) |
| Driver | mongoose 8.x (Node 20) |
| Models directory | `backend/src/models/` |
| Related files | `backend/src/config/rbac.js`, `backend/src/middleware/tenant.js` |

---

## 1. ERD Overview

VeloManage uses 26 collections. Every domain collection carries
`organizationId` for tenant isolation; cross-collection relationships are
modeled with `ObjectId` references resolved by Mongoose `populate()` or by
explicit join in aggregation pipelines. Sub-documents (embedded arrays) are
used for tightly-coupled, read-with-parent data (e.g. `Vehicle.events`,
`User.refreshTokens`, `Vehicle.documents`).

### 1.1 Tenant + identity collections

| Model | File | Key fields | Relationships |
|---|---|---|---|
| Organization | `models/Organization.js` | `name`, `slug` (unique), `plan`, `limits`, `settings`, `parentId`, `country`, `currency`, `timezone`, `locale`, `branding`, `isActive`, `trialEndsAt` | self-ref (`parentId`); parent of every domain collection |
| User | `models/User.js` | `name`, `email` (unique), `password` (bcrypt, `select:false`), `role` (16 enum), `organizationId`, `branchId`, `refreshTokens[]`, `loginHistory[]`, `mfa{}`, `oauth{}`, `profile{}`, `driverProfile{}`, `preferences{}`, `consent{}`, `failedLoginAttempts`, `lockedUntil` | belongs to Organization, Branch; self-ref via `reportsTo` |
| Branch | `models/Branch.js` | `name`, `organizationId`, `address`, `coordinates`, `managerId`, `isActive` | belongs to Organization; parent of Users, Vehicles |
| AuditLog | `models/AuditLog.js` | `userId`, `userRole`, `userEmail`, `organizationId`, `action`, `category`, `severity`, `resourceType`, `resourceId`, `status`, `statusCode`, `before`, `after`, `ipAddress`, `userAgent`, `geo`, `traceId` | belongs to User, Organization |

### 1.2 Fleet + asset collections

| Model | File | Key fields | Relationships |
|---|---|---|---|
| Vehicle | `models/Vehicle.js` | `vehicleId` (unique), `vin`, `licensePlate`, `type`, `category`, `make`, `model`, `year`, `specifications{}`, `registration{}`, `insurance{}`, `acquisition{}`, `depreciation{}`, `odometer{}`, `telematics{}`, `currentLocation{}`, `maintenance{}`, `documents[]`, `events[]`, `status`, `lifecycleStage`, `assignedDriverId`, `assignmentHistory[]`, `isActive`, `tags[]` | belongs to Organization, Branch; assigned to User (driver) |
| Driver | `models/Driver.js` | `userId`, `licenseNumber`, `licenseClass[]`, `licenseExpiry`, `assignedVehicleId`, `hoursOfService{}`, `medical{}`, `training[]`, `score`, `isActive` | belongs to Organization, User; assigned to Vehicle |
| Asset | `models/Asset.js` | `assetId`, `type`, `category`, `description`, `acquisition{}`, `depreciation{}`, `assignedTo`, `location`, `documents[]`, `isActive` | belongs to Organization |
| Geofence | `models/Geofence.js` | `name`, `type` (circle/polygon), `coordinates`, `radius`, `rules[]`, `alerts[]`, `isActive` | belongs to Organization |
| Location | `models/Location.js` | `name`, `address`, `coordinates`, `type` (depot/warehouse/customer), `capacity`, `isActive` | belongs to Organization |

### 1.3 Operations collections

| Model | File | Key fields | Relationships |
|---|---|---|---|
| Trip | `models/Trip.js` | `vehicleId`, `driverId`, `origin{}`, `destination{}`, `startTime`, `endTime`, `distanceKm`, `durationMin`, `status`, `route[]`, `notes` | belongs to Organization, Vehicle, Driver |
| MaintenanceWorkOrder | `models/MaintenanceWorkOrder.js` | `vehicleId`, `type`, `priority`, `status`, `assignedMechanicId`, `parts[]`, `laborHours`, `cost`, `scheduledAt`, `completedAt`, `notes` | belongs to Organization, Vehicle, User (mechanic) |
| Part | `models/Part.js` | `sku`, `name`, `category`, `quantityInStock`, `reorderLevel`, `unitCost`, `supplierId` | belongs to Organization, Vendor |
| FuelTransaction | `models/FuelTransaction.js` | `vehicleId`, `driverId`, `fuelCardId`, `volume`, `unit`, `amount`, `currency`, `odometer`, `stationName`, `location`, `anomalyFlag`, `timestamp` | belongs to Organization, Vehicle, Driver, FuelCard |
| FuelCard | `models/FuelCard.js` | `cardNumber` (encrypted), `provider`, `vehicleId`, `driverId`, `limit`, `currency`, `isActive` | belongs to Organization, Vehicle, Driver |
| Accident | `models/Accident.js` | `vehicleId`, `driverId`, `date`, `location`, `severity`, `description`, `involvedParties[]`, `photos[]`, `policeReport`, `insuranceClaim{}`, `status` | belongs to Organization, Vehicle, Driver |
| Compliance | `models/Compliance.js` | `entityType`, `entityId`, `type` (inspection/license/permit/violation), `issuedAt`, `expiresAt`, `status`, `documents[]`, `authority`, `findings[]` | belongs to Organization; polymorphic entity reference |

### 1.4 Finance + procurement collections

| Model | File | Key fields | Relationships |
|---|---|---|---|
| FinanceTransaction | `models/FinanceTransaction.js` | `type` (income/expense/transfer), `category`, `amount`, `currency`, `date`, `vehicleId`, `driverId`, `vendorId`, `description`, `status`, `approvedBy`, `glAccount` | belongs to Organization, Vehicle, Driver, Vendor |
| Budget | `models/Budget.js` | `name`, `fiscalYear`, `period`, `category`, `allocated`, `spent`, `remaining`, `currency`, `status`, `approvedBy` | belongs to Organization |
| Contract | `models/Contract.js` | `type` (vehicle/vendor/customer/lease), `partyId`, `partyType`, `startDate`, `endDate`, `value`, `currency`, `terms`, `documents[]`, `status` | belongs to Organization; polymorphic party |
| PurchaseOrder | `models/PurchaseOrder.js` | `poNumber`, `vendorId`, `items[]`, `subtotal`, `tax`, `total`, `currency`, `status`, `requestedBy`, `approvedBy`, `receivedAt`, `invoicedAt` | belongs to Organization, Vendor, User |
| Vendor | `models/Vendor.js` | `name`, `category`, `contact{}`, `paymentTerms`, `rating`, `contracts[]`, `isActive` | belongs to Organization |
| Customer | `models/Customer.js` | `name`, `type` (individual/business), `contact{}`, `contracts[]`, `serviceHistory[]`, `slaTier`, `isActive` | belongs to Organization |

### 1.5 HR collections

| Model | File | Key fields | Relationships |
|---|---|---|---|
| Staff | `models/Staff.js` | `userId`, `employeeId`, `department`, `position`, `employmentType`, `hireDate`, `terminationDate`, `salary`, `currency`, `leave[]`, `attendance[]`, `payroll[]`, `documents[]` | belongs to Organization, User |
| Message | `models/Message.js` | `senderId`, `recipientId`, `recipientType`, `body`, `attachments[]`, `readAt`, `threadId` | belongs to Organization, User |

### 1.6 Legacy collections (kept for backward compatibility)

| Model | File | Notes |
|---|---|---|
| Truck | `models/Truck.js` | Superseded by Vehicle; kept so existing frontend routes continue to work. New code should use Vehicle. |
| Booking | `models/Booking.js` | Legacy booking flow; will be migrated to Trip + Customer in Phase 3. |

### ERD (high-level)

```
Organization ──┬── User ──┬── Staff
               │           └── Driver ──┐
               │                        │
               ├── Branch               │
               │                        │
               ├── Vehicle ─────────────┤
               │      │                 │
               │      ├── MaintenanceWorkOrder ── Part
               │      ├── FuelTransaction ── FuelCard
               │      ├── Trip
               │      ├── Accident
               │      ├── Compliance
               │      └── FinanceTransaction
               │
               ├── Geofence
               ├── Location
               ├── Asset
               ├── Customer ── Contract
               ├── Vendor ── PurchaseOrder ── Part
               ├── Budget
               └── AuditLog (immutable)
```

---

## 2. Indexing Strategy

### 2.1 Compound indexes for tenant-scoped queries
Every domain collection's primary access pattern is "list by tenant, sorted by
recency". Therefore each model defines a compound index
`{ organizationId: 1, <sortKey>: 1 }`. Examples from
`backend/src/models/Vehicle.js:240-247`:

```js
vehicleSchema.index({ organizationId: 1, vehicleId: 1 }, { unique: true });
vehicleSchema.index({ organizationId: 1, licensePlate: 1 });
vehicleSchema.index({ organizationId: 1, status: 1, isActive: 1 });
vehicleSchema.index({ organizationId: 1, type: 1 });
vehicleSchema.index({ organizationId: 1, branchId: 1 });
vehicleSchema.index({ organizationId: 1, assignedDriverId: 1 });
```

### 2.2 Unique indexes on natural keys
- `Organization.slug` (unique)
- `User.email` (unique, case-insensitive)
- `Vehicle.vehicleId` unique within tenant (compound with `organizationId`)
- `Vehicle.vin` sparse (some vehicles have no VIN)
- `Vehicle.telematics.deviceId` sparse

### 2.3 Soft-delete indexes
Most collections have `isActive: Boolean`. List queries filter
`{ organizationId, isActive: true, ... }`; the compound
`{ organizationId: 1, status: 1, isActive: 1 }` covers both filters in one
index scan.

### 2.4 TTL indexes
- `AuditLog.timestamp` TTL = `2555 * 24 * 60 * 60` seconds (7 years).
  After TTL, the document is automatically deleted by MongoDB's TTL monitor.
  See `backend/src/models/AuditLog.js:83`.
- Planned: `User.refreshTokens.expiresAt` TTL (currently cleaned
  application-side; switching to a TTL index in Phase 2).
- Planned: `FuelTransaction` time-based partitioning (Phase 4) for archival.

### 2.5 Text indexes
- `Vehicle` and `Customer` have planned text indexes on
  `{ vehicleId, licensePlate, make, model }` and `{ name, contact.email }`
  respectively — currently served by `createCrudRouter`'s `?search=` query
  via `$or` regex; text indexes will replace that for large tenants.

### 2.6 Geospatial indexes
- `Vehicle.currentLocation.latitude/longitude` — `2dsphere` index (planned
  Phase 2 alongside live GPS).
- `Geofence.coordinates` — `2dsphere` for `$geoIntersects` queries.
- `Location.coordinates` — `2dsphere`.

---

## 3. Sharding Strategy

VeloManage will move to a sharded cluster once any single collection exceeds
10 M documents or 200 GB. The chosen shard key is
`{ organizationId: "hashed", _id: 1 }`.

### Why `organizationId` (hashed)?
- Every query is tenant-scoped; the query router can target a single shard
  when `organizationId` is in the filter (which it always is, via
  `tenantFilter()`).
- Hashed distribution avoids hot shards from large tenants (a single huge
  tenant would otherwise live on one shard with a ranged key).
- Compound `{ organizationId: 1, _id: 1 }` index on every collection
  already exists, so the shard key is a prefix of an existing index →
  non-breaking migration.

### Migration plan (Phase 4)
1. Enable sharding on the database: `sh.enableSharding("velomanage")`.
2. Create the index `{ organizationId: "hashed", _id: 1 }` on each
   collection to be sharded (Vehicle, Trip, FuelTransaction, AuditLog,
   FinanceTransaction).
3. `sh.shardCollection("velomanage.vehicles", { organizationId: "hashed", _id: 1 })`.
4. Monitor chunk distribution; pre-split if a tenant is abnormally large.

### Collections NOT to shard
- `Organization` (≤ 200 K docs expected at full scale — single shard).
- `User` — borderline; sharded at 5 M+.
- Small reference collections.

---

## 4. Partitioning (Time-Series)

For high-volume time-series data (audit logs, fuel transactions, GPS pings),
we will use time-based partitioning via MongoDB's **zone sharding** in
Phase 4:

- Define monthly zones on `timestamp` ranges.
- Tag older zones to lower-cost shards ("warm" / "cold" tiers).
- Hot tier (last 90 days) on NVMe-backed shards; warm tier (90 days–2 years)
  on standard SSD; cold tier (2–7 years) on object-storage-backed shards
  (Atlas Online Archive).

Implementation is the `audit-archive-worker` BullMQ job that moves records
past their hot-tier age to archive collections.

---

## 5. Archiving

### 5.1 Audit log archive
- TTL: 7 years (2555 days) on `AuditLog.timestamp`.
- Beyond 7 years, records are deleted (TTL monitor). For organizations that
  require longer retention (e.g. government), the `Organization.settings.
  dataRetentionDays` field overrides the default by setting a per-tenant
  TTL via a partial index expression — Phase 4 enhancement.
- Cold storage: Atlas Online Archive moves records older than 90 days to
  S3-backed queryable archive; same query syntax, slower latency.

### 5.2 Fuel transaction archive
- Records > 3 years moved to `fueltransactions_archive` collection.
- Reporting queries that need historical data union both collections via
  `$unionWith`.

### 5.3 GPS ping archive
- (Phase 2) raw pings rolled up to 1-minute aggregates after 30 days; raw
  pings archived after 1 year.

### 5.4 User data archive (GDPR)
- Right-to-be-forgotten requests set `User.dataRetention.deleteAfter` to
  a date 90 days in the future.
- A daily BullMQ job anonymizes such users: name → "Deleted User",
  email → `deleted+<uuid>@velomanage.invalid`, password → random,
  `profile`/`driverProfile`/`oauth` nullified, `anonymizedAt` set.
- Audit logs retain the original `userEmail` for accountability — GDPR
  Art. 17(3)(b) exemption for legal-obligation retention.

---

## 6. Backup Strategy

| Layer | Mechanism | Frequency | Retention | Location |
|---|---|---|---|---|
| Continuous backup | Atlas PITR (point-in-time recovery) | continuous | 7 days | Atlas-managed cloud storage |
| Snapshot | Atlas scheduled snapshot | daily 02:00 UTC | 30 days | Atlas |
| Logical dump | `mongodump` via Kubernetes `CronJob` | daily 03:00 UTC | 14 days | S3 bucket `velomanage-mongodump` |
| Pre-deployment snapshot | Atlas on-demand snapshot | before each deploy | 7 days | Atlas |
| Cross-region copy | Atlas backup distribution | daily | 30 days | Secondary region |

Backups are encrypted at rest with AES-256 (Atlas-managed KMS or
customer-managed keys via AWS KMS in Phase 4).

### Restoration testing
- Monthly restore drill: a snapshot is restored into a staging cluster and
  a smoke-test suite runs against it.
- Quarterly full DR drill: cross-region restore + traffic switch in a
  staging environment.

---

## 7. Disaster Recovery

| Metric | Target |
|---|---|
| RPO (Recovery Point Objective) | 15 minutes |
| RTO (Recovery Time Objective) | 4 hours |
| Failover mechanism | Atlas automatic failover (≤ 30 s for primary loss) |
| Cross-region failover | Manual: restore latest PITR snapshot in secondary region, repoint DNS |
| Data loss ceiling | Last 15 minutes of writes (worst case) |

### Runbook summary
1. **Detection**: Prometheus alert fires if `/ready` returns 503 for > 60 s
   or if Atlas reports a cluster health event.
2. **Containment**: scale API to min replicas, enable maintenance page via
   Ingress annotation.
3. **Recovery**: if Atlas primary can be re-elected within 5 minutes, wait;
   otherwise trigger cross-region restore.
4. **Validation**: run smoke tests against restored cluster; switch DNS.
5. **Post-mortem**: within 5 business days, RCA published to
   `docs/incidents/<date>-<slug>.md`.

Full DR procedures in `docs/ADMIN_MANUAL.md` §Disaster Recovery.

---

## 8. Sample Queries

### 8.1 Paginated list with tenant filter
This is the canonical query served by `createCrudRouter` for `GET /api/v1/vehicles?page=2&limit=20&status=active&sort=-createdAt&search=toyota`.

```js
const filter = {
  organizationId: req.tenantId,    // from tenantFilter(req)
  isActive: true,
  status: 'active',
  $or: [
    { vehicleId: /toyota/i },
    { licensePlate: /toyota/i },
    { make: /toyota/i },
    { model: /toyota/i },
  ],
};

const [items, total] = await Promise.all([
  Vehicle.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('assignedDriverId', 'name email')
    .lean(),
  Vehicle.countDocuments(filter),
]);

return {
  success: true,
  data: items,
  pagination: {
    page, limit, total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  },
};
```

Hits the compound index
`{ organizationId: 1, status: 1, isActive: 1 }` followed by an in-memory
filter on the `$or` clause; for tenants > 100 K vehicles, a text index
replaces the `$or`.

### 8.2 Aggregation pipeline — cost-per-km dashboard
`GET /api/v1/finance/reports/cost-per-km?from=2026-01-01&to=2026-06-30&groupBy=vehicle`.

```js
const result = await FinanceTransaction.aggregate([
  { $match: {
      organizationId: req.tenantId,
      date: { $gte: new Date(from), $lte: new Date(to) },
      status: 'approved',
  }},
  { $group: {
      _id: { vehicleId: '$vehicleId', category: '$category' },
      total: { $sum: '$amount' },
      currency: { $first: '$currency' },
  }},
  { $group: {
      _id: '$_id.vehicleId',
      costs: { $push: { category: '$_id.category', total: '$total' } },
      totalCost: { $sum: '$total' },
  }},
  { $lookup: {
      from: 'vehicles',
      localField: '_id',
      foreignField: '_id',
      as: 'vehicle',
  }},
  { $unwind: '$vehicle' },
  { $project: {
      _id: 0,
      vehicleId: '$_id',
      vehicle: { vehicleId: 1, licensePlate: 1, make: 1, model: 1 },
      totalCost: 1,
      costs: 1,
      odometerStart: '$vehicle.odometer.current',
  }},
  { $sort: { totalCost: -1 } },
]);
```

Then enriched with odometer deltas from `Vehicle.odometer.history` to compute
`costPerKm = totalCost / (odometerEnd - odometerStart)`.

### 8.3 Audit log query — "what did this user do in the last 24 hours?"
```js
const events = await AuditLog.find({
  userId,
  timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
}).sort({ timestamp: -1 }).limit(500);
```
Hits index `{ userId: 1, timestamp: -1 }`.

### 8.4 Cross-tenant admin query (super_admin only)
```js
// super_admin bypasses tenantFilter — empty filter returns across all tenants
const filter = req.tenantFilter(); // returns {}
const vehicles = await Vehicle.find(filter).limit(100);
```

### 8.5 Geofence breach detection (Phase 2)
```js
const breaches = await Vehicle.find({
  organizationId: req.tenantId,
  'currentLocation.latitude': { $ne: null },
  currentLocation: {
    $geoWithin: { $geometry: geofence.geometry },
  },
});
```

---

## 9. Schema Evolution

- Mongoose schema migrations are managed via `backend/scripts/init-database.js`
  (creates indexes, seeds super_admin, sets up reference data).
- Breaking schema changes ship with a backwards-compatible read path:
  - New field added → old documents return `undefined`; readers use defaults.
  - Field renamed → both names written during transition, old name removed
    after one release.
  - Field type changed → dual-write during transition; aggregation pipelines
    use `$ifNull` to handle both.
- No separate migration tool (e.g. migrate-mongo) is used in Phase 1; we
  will add one in Phase 2 if breaking changes accumulate.

---

## 10. Capacity Planning

| Collection | Projected docs at full scale (5 years) | Avg doc size | Storage |
|---|---|---|---|
| Organization | 200,000 | 4 KB | 0.8 GB |
| User | 10,000,000 | 6 KB | 60 GB |
| Vehicle | 1,000,000 | 8 KB | 8 GB |
| Trip | 500,000,000 | 2 KB | 1 TB |
| FuelTransaction | 200,000,000 | 1 KB | 200 GB |
| MaintenanceWorkOrder | 50,000,000 | 3 KB | 150 GB |
| AuditLog | 2,000,000,000 | 2 KB | 4 TB (sharded, archived) |
| FinanceTransaction | 300,000,000 | 1.5 KB | 450 GB |

Total estimated MongoDB storage at year 5: ~6 TB hot + ~10 TB archive.
This drives the sharding timeline: Trip and AuditLog must be sharded by
end of Year 2.
