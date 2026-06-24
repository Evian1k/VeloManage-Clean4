# VeloManage — User Manual

| Field | Value |
|---|---|
| Document version | 1.0 |
| Audience | End users of VeloManage (fleet managers, drivers, mechanics, finance, compliance, auditors) |
| Related files | `docs/PRD.md`, `docs/ADMIN_MANUAL.md`, `backend/src/routes/auth.js` |

This manual covers the standard day-to-day workflows in VeloManage. For
platform-level administration (organizations, billing, audit log review,
DR), see `docs/ADMIN_MANUAL.md`.

---

## 1. Getting Started

### 1.1 Register an account
1. Open the VeloManage web app at your organization's URL.
2. Click **Register**.
3. Fill in:
   - **Full name** (required, max 100 characters)
   - **Email** (required, must be unique across the platform)
   - **Password** (min 8 characters; must include upper + lower + number)
   - **Organization** — choose an existing org (invite code) or
     "Create new organization"
4. For a new organization, also fill in:
   - Organization name, country, currency, timezone, plan
5. Click **Create account**. You will receive a verification email; click
   the link to verify.
6. The first user in a new organization is auto-assigned the
   `company_owner` role.

### 1.2 Log in
1. Open the VeloManage web app.
2. Enter email + password.
3. If your organization has MFA enforced (Phase 2), enter the 6-digit
   TOTP code from your authenticator app.
4. You receive:
   - an **access token** (15-minute TTL, kept in memory)
   - a **refresh token** (30-day TTL, kept in httpOnly cookie or secure
     storage)
5. After 15 minutes, the app automatically uses the refresh token to get
   a new access token — you stay logged in for up to 30 days.

### 1.3 Set up MFA (when available — Phase 2)
1. Go to **Settings → Security**.
2. Click **Enable MFA**.
3. Scan the QR code with Google Authenticator, Authy, or 1Password.
4. Enter the 6-digit code to confirm enrollment.
5. Save the 10 backup codes somewhere safe — each can be used once if
   you lose your device.

### 1.4 Reset a forgotten password
1. On the login page, click **Forgot password?**.
2. Enter your email; click **Send reset link**.
3. Check your inbox for an email with a reset link (valid for 1 hour).
4. Click the link, enter a new password (must not match your last 5
   passwords), and submit.
5. All existing refresh tokens for your account are revoked — you must
   log in again on every device.

---

## 2. Organization Admin

The **Company Owner** (or any user with `organization:write`) is
responsible for setting up the organization, users, and branches.

### 2.1 Create users
1. Go to **Admin → Users**.
2. Click **Invite user**.
3. Fill in name, email, role (see role table in `docs/PRD.md` §4),
   branch (optional).
4. Click **Send invite**. The invitee receives an email with a
   sign-up link.
5. The user appears in the list with status "Pending" until they
   complete registration.

### 2.2 Assign and change roles
1. Go to **Admin → Users**.
2. Click on a user.
3. In the **Role** dropdown, choose a new role.
4. Click **Save**. The change takes effect immediately — the user's
   next request is checked against the new role.
5. The action is recorded in the audit log.

### 2.3 Set up branches
1. Go to **Admin → Branches**.
2. Click **Add branch**.
3. Fill in name, address, coordinates (auto-filled from address),
   branch manager.
4. Click **Create**.
5. Assign users and vehicles to branches via their respective edit
   screens.

### 2.4 Configure organization settings
Go to **Settings → Organization** to configure:
- **Branding**: logo, primary color, custom domain (Phase 4)
- **Password policy**: min length, character requirements, expiry
- **Session timeout**: 30–480 minutes
- **IP allowlist**: list of CIDR ranges
- **Data retention**: 1–10 years (default 7)
- **MFA requirements**: optional / required for admins / required for all

---

## 3. Fleet Manager

The **Fleet Manager** role is the operational owner of the vehicle
fleet. Default permissions: read/write on vehicles, drivers,
maintenance, fuel, GPS, trips, compliance, accidents.

### 3.1 Add a vehicle
1. Go to **Fleet → Vehicles**.
2. Click **Add vehicle**.
3. Fill in:
   - **Vehicle ID** (unique within your organization; e.g. `TRK-001`)
   - **License plate** (required)
   - **VIN** (recommended, validated for length 11-17)
   - **Type** (truck, trailer, van, car, motorcycle, bus, heavy
     equipment, tanker, refrigerated, flatbed, container, light vehicle,
     other)
   - **Make / Model / Year**
   - **Specifications**: fuel type, engine size, transmission,
     payload capacity, fuel tank capacity, average consumption, etc.
   - **Registration**: number, issuing authority, expiry
   - **Insurance**: provider, policy number, coverage, premium
   - **Acquisition**: date, method (purchase / lease / rental /
     financing / donated), cost, vendor
   - **Telematics**: device ID, provider (if installed)
4. Click **Create**. The vehicle appears in the fleet list with
   status "active".

### 3.2 Assign a driver
1. Go to **Fleet → Vehicles**.
2. Click on the vehicle.
3. Click **Assign driver**.
4. Choose a driver from the dropdown (only active drivers in the same
   branch appear).
5. Optionally enter a reason (e.g. "Route reassignment").
6. Click **Assign**. The previous driver (if any) is unassigned and
   recorded in `assignmentHistory`.

### 3.3 View fleet map (Phase 2)
1. Go to **Fleet → Live map**.
2. All active vehicles appear as markers, color-coded by status:
   - Green: active, moving
   - Yellow: active, idle
   - Red: in maintenance or out of service
   - Gray: retired
3. Click a marker to see vehicle details, driver, current trip.
4. Filter by branch, type, status using the top filter bar.

### 3.4 Plan maintenance
1. Go to **Maintenance → Work orders**.
2. Click **New work order**.
3. Choose vehicle, type (planned / breakdown / inspection), priority,
   description, scheduled date.
4. Assign a mechanic (optional at creation).
5. Click **Create**. The mechanic receives a notification (in-app +
   push if Phase 2 is live).

---

## 4. Driver

The **Driver** role has the narrowest permissions: read vehicle + GPS,
write GPS + fuel + accidents, read assigned trips.

### 4.1 View assigned trips
1. Log in to the mobile app (Phase 2) or web app.
2. The **Home** screen shows today's assigned trips in chronological
   order.
3. Tap a trip to see pickup/drop-off locations, route, customer
   instructions.
4. Tap **Start trip** when departing; **Complete trip** when finished.
5. The system logs start/end time, distance (from GPS), and duration.

### 4.2 Log fuel
1. Tap **Log fuel** on the home screen.
2. Select the vehicle (defaults to your assigned vehicle).
3. Enter:
   - Volume + unit (L or gal)
   - Total amount + currency
   - Odometer reading
   - Station name (optional)
   - Fuel card (if assigned)
4. Tap photo icon to attach a receipt photo (Phase 2).
5. Tap **Save**. The transaction is recorded; anomaly detection (Phase 3)
   may flag it later if the volume/odometer pattern looks suspicious.

### 4.3 Report an accident
1. Tap **Report accident** on the home screen.
2. Select the vehicle involved (defaults to your assigned vehicle).
3. Fill in:
   - Date + time
   - Location (auto-filled from GPS, editable)
   - Severity (minor / moderate / severe)
   - Description
   - Involved parties (other drivers, vehicles, witnesses)
4. Tap photo icon to attach photos of the scene.
5. Tap **Submit**. The accident is reported to your fleet manager and
   compliance officer; an insurance claim record is created in
   `Accident.insuranceClaim`.

### 4.4 Update GPS location (Phase 2)
- Background GPS capture runs automatically when you are on an active
  trip; no manual action needed.
- If you deny location permission, the app falls back to manual
  check-in: tap **Check in** on the home screen to send your current
  location once.

---

## 5. Mechanic

The **Mechanic** role has read access to vehicles and write access to
maintenance work orders and parts.

### 5.1 View work orders
1. Go to **Maintenance → Work orders**.
2. Filter by status (open / in progress / on hold / completed / closed),
   priority, or assigned mechanic.
3. Click a work order to see details: vehicle, parts required, labor
   estimate, scheduled date.

### 5.2 Update work order status
1. Open the work order.
2. Click **Start** to mark it `in_progress` (only when actually starting
   work).
3. As you complete tasks, log:
   - Parts used (sku, quantity) — pulled from inventory
   - Labor hours
   - Notes / findings
4. Click **Complete** when done. The work order moves to `completed`
   status; the vehicle's `maintenance.lastServiceAt` and
   `maintenance.lastServiceMileage` are updated.
5. The fleet manager reviews and clicks **Close** to finalize.

### 5.3 Log parts usage
1. Open the work order.
2. Scroll to the **Parts** section.
3. Click **Add part**.
4. Search by SKU or name; enter quantity used.
5. Click **Add**. The part's `quantityInStock` is decremented; if it
   falls below `reorderLevel`, a procurement alert is created.

---

## 6. Finance Officer

The **Finance Officer** role manages budgets, finance transactions, and
reports.

### 6.1 Record a transaction
1. Go to **Finance → Transactions**.
2. Click **New transaction**.
3. Fill in:
   - Type (income / expense / transfer)
   - Category (fuel, maintenance, insurance, salary, procurement, etc.)
   - Amount + currency
   - Date
   - Vehicle / driver / vendor (optional links)
   - Description
   - GL account (for accounting export)
4. Click **Save**. The transaction is created with status `pending`.

### 6.2 Approve a transaction
1. Go to **Finance → Transactions → Pending approval**.
2. Review the transaction details.
3. Click **Approve** (status → `approved`) or **Reject** (status →
   `rejected`, reason required).
4. Approved transactions appear in reports; rejected transactions do
   not.

### 6.3 Manage budgets
1. Go to **Finance → Budgets**.
2. Click **New budget**; enter fiscal year, period (monthly / quarterly
   / annual), category, allocated amount.
3. As transactions are approved, the `spent` and `remaining` fields
   update automatically.
4. Budgets at > 90 % utilization trigger an alert to the finance team.

### 6.4 View reports
1. Go to **Finance → Reports**.
2. Choose a report:
   - **P&L**: income vs expense by period
   - **Cost per km**: total cost / distance traveled, per vehicle
   - **Fuel summary**: volume + cost by vehicle / driver / period
   - **Maintenance cost**: by vehicle / type / period
3. Choose date range and group-by; click **Run**.
4. Click **Export** to download as CSV or PDF.

---

## 7. Compliance Officer

The **Compliance Officer** role tracks inspections, licenses, permits,
and violations.

### 7.1 Track inspections
1. Go to **Compliance → Inspections**.
2. Each inspection record shows: entity (vehicle / driver / asset),
   type, issued date, expiry date, status, authority, findings.
3. The **Expiring** tab shows all items expiring in the next 30/60/90
   days — use this as your work list.

### 7.2 Manage compliance records
1. Click **New record**.
2. Choose entity type (vehicle / driver / asset), entity ID.
3. Choose type (inspection / license / permit / violation).
4. Fill in issue date, expiry, issuing authority, status.
5. Upload supporting documents (PDF / image).
6. Click **Save**.

### 7.3 Renew a compliance item
1. Open the compliance record.
2. Click **Renew**.
3. Enter new expiry date, upload new document.
4. Click **Save**. The old record is archived (kept for audit); a new
   record is created with status `active`.

### 7.4 Generate compliance report
1. Go to **Compliance → Reports**.
2. Choose period + entity scope.
3. Click **Generate**. The system compiles a PDF with:
   - All compliance items active in the period
   - All violations and their resolution status
   - Inspection pass rate
4. Click **Export** to download for submission to regulators.

---

## 8. Auditor

The **Auditor** role has read-only access to audit log, finance,
compliance, and analytics. Auditors cannot create, update, or delete
anything.

### 8.1 Review audit log
1. Go to **Audit → Log**.
2. Filter by:
   - User
   - Action (e.g. `vehicle.create`, `auth.login`)
   - Category (auth / vehicle / finance / etc.)
   - Severity (info / warning / critical)
   - Date range
   - Status (success / failure / denied)
3. Click an entry to see full details: who, when, where, what changed
   (`before` vs `after` diff).
4. Click **Export** to download the filtered set as CSV (max 100,000
   rows) for compliance evidence.

### 8.2 Investigate a security incident
1. Filter audit log by `severity = critical` or `status = denied`.
2. Look for patterns: multiple denials from one IP, logins from
   unexpected geos, mass exports.
3. Cross-reference with finance transactions and compliance events.
4. Use the `traceId` field to follow a single request across logs.

---

## 9. Mobile App Usage (Phase 2)

When the mobile app is available (App Store + Play Store), install it
and log in with the same credentials as the web app.

### Supported features by role
| Role | Features |
|---|---|
| Driver | view trips, log fuel, report accident, GPS check-in, messages |
| Mechanic | view work orders, update status, log parts, scan parts (QR) |
| Fleet Manager | live map, exception alerts, approve maintenance |
| Operations Manager | dispatch trips, live map, alerts |
| Compliance Officer | expiring items, upload documents |
| All | profile, MFA, push notifications, messages |

### Offline behavior
- The app caches the last sync of your data locally.
- Mutations performed offline (fuel log, accident report, work order
  status update) are queued and replayed when you reconnect.
- Conflicts are resolved by `updatedAt` timestamp (last-write-wins)
  except for critical fields (odometer, fuel volume) which require
  manual reconciliation.
- A banner appears at the top of the screen when offline; tap it to
  see pending mutations.

### Push notifications
- Drivers: new trip assigned, dispatch update, message from manager
- Mechanics: new work order assigned, parts low
- Fleet Managers: geofence breach, maintenance overdue, accident
  reported
- Finance Officers: budget at 90 %, transaction pending approval
- Compliance Officers: item expiring in 7 days

Configure per-category in **Settings → Notifications**.
