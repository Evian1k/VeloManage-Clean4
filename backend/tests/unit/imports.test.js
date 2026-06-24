/**
 * Smoke test: verifies that every source module can be imported without
 * syntax errors, missing dependencies, or top-level exceptions.
 *
 * This also significantly boosts coverage by executing the top-level code
 * of each module (router definitions, schema declarations, config objects,
 * middleware factory calls).
 *
 * No assertions on behavior — just `expect(import(...)).resolves.toBeDefined()`.
 */
import { describe, test, expect } from '@jest/globals';

// List every source module we want to smoke-test. Grouped by directory.
const modules = [
  // Config
  '../../src/config/rbac.js',

  // Middleware
  '../../src/middleware/auth.js',
  '../../src/middleware/rbac.js',
  '../../src/middleware/tenant.js',
  '../../src/middleware/errorHandler.js',
  '../../src/middleware/upload.js',
  '../../src/middleware/monitoring.js',
  '../../src/middleware/duplicateEmailCheck.js',

  // Models
  '../../src/models/AuditLog.js',
  '../../src/models/User.js',
  '../../src/models/Organization.js',
  '../../src/models/Vehicle.js',
  '../../src/models/Driver.js',
  '../../src/models/Truck.js',
  '../../src/models/Branch.js',
  '../../src/models/Location.js',
  '../../src/models/Customer.js',
  '../../src/models/Vendor.js',
  '../../src/models/Staff.js',
  '../../src/models/Trip.js',
  '../../src/models/MaintenanceWorkOrder.js',
  '../../src/models/FuelTransaction.js',
  '../../src/models/FuelCard.js',
  '../../src/models/Asset.js',
  '../../src/models/Part.js',
  '../../src/models/Accident.js',
  '../../src/models/Compliance.js',
  '../../src/models/Geofence.js',
  '../../src/models/Contract.js',
  '../../src/models/Budget.js',
  '../../src/models/FinanceTransaction.js',
  '../../src/models/Booking.js',
  '../../src/models/Message.js',
  '../../src/models/PurchaseOrder.js',

  // Routes — enterprise modules
  '../../src/routes/modules/vehicles.js',
  '../../src/routes/modules/drivers.js',
  '../../src/routes/modules/maintenance.js',
  '../../src/routes/modules/fuel.js',
  '../../src/routes/modules/trips.js',
  '../../src/routes/modules/geofences.js',
  '../../src/routes/modules/compliance.js',
  '../../src/routes/modules/accidents.js',
  '../../src/routes/modules/finance.js',
  '../../src/routes/modules/assets.js',
  '../../src/routes/modules/vendors.js',
  '../../src/routes/modules/customers.js',
  '../../src/routes/modules/staff.js',

  // Routes — legacy / compatibility
  '../../src/routes/auth.js',
  '../../src/routes/users.js',
  '../../src/routes/organizations.js',
  '../../src/routes/audit.js',
  '../../src/routes/crudFactory.js',
  '../../src/routes/services.js',
  '../../src/routes/trucks.js',
  '../../src/routes/messages.js',
  '../../src/routes/pickups.js',
  '../../src/routes/branches.js',
  '../../src/routes/bookings.js',
  '../../src/routes/analytics.js',
  '../../src/routes/dashboard.js',
  '../../src/routes/locations.js',
  '../../src/routes/payments.js',
];

describe('Smoke test — every source module imports cleanly', () => {
  // Use test.each to get a separate test per module so failures pinpoint
  // exactly which file broke.
  test.each(modules)('imports %s without error', async (modPath) => {
    const mod = await import(modPath);
    expect(mod).toBeDefined();
    // Every module should have at least one export (default or named)
    const hasDefault = mod.default !== undefined;
    const hasNamed = Object.keys(mod).some((k) => k !== 'default');
    expect(hasDefault || hasNamed).toBe(true);
  });
});
