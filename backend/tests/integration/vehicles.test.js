/**
 * Integration tests for the vehicle CRUD routes (/api/v1/vehicles/*).
 *
 * Mocks:
 *   - authenticateToken middleware → attaches a configurable fake user
 *   - Vehicle model                → chainable query mocks (find, findOne, etc.)
 *   - AuditLog.recordAudit         → no-op (would otherwise try MongoDB)
 *
 * Real middleware exercised:
 *   - attachTenant      (skips org lookup because mock user has no orgId)
 *   - tenantFilter      (pure function)
 *   - requirePermission (RBAC check against req.user.role)
 *
 * Covers:
 *   GET    /                - 200 with paginated list
 *   GET    /:id             - 404 when not found
 *   POST   /                - 403 for driver (no vehicles:write), 201 on valid input
 *   DELETE /:id             - 404 when not found
 */
import { jest, describe, test, expect, beforeAll, beforeEach } from '@jest/globals';

// ─── Configurable mock auth state ──────────────────────────────────────────
// The mock authenticateToken reads from this object so each test can swap
// the authenticated user (e.g. fleet_manager vs driver) without re-mocking.
const mockAuthState = {
  user: {
    _id: '507f1f77bcf86cd7994390aa',
    role: 'fleet_manager',
    email: 'fleet@example.com',
    organizationId: null, // null → attachTenant skips org lookup
  },
};

jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  authenticateToken: (req, res, next) => {
    req.user = mockAuthState.user;
    next();
  },
  // Re-export the other middleware from the real module (not used here, but
  // keeps the mock shape complete for any code that imports them).
  requireAdmin: (req, res, next) => next(),
  requireMainAdmin: (req, res, next) => next(),
  requireOwnershipOrAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
}));

// ─── Mock Vehicle model ────────────────────────────────────────────────────
/**
 * Build a chainable thenable that mimics a Mongoose query.
 * Supports: .select().populate().lean().sort().skip().limit().exec()
 * and is await-able directly.
 */
function chainableQuery(resolvedValue) {
  const query = {};
  const promise = Promise.resolve(resolvedValue);
  query.select = jest.fn(() => query);
  query.populate = jest.fn(() => query);
  query.lean = jest.fn(() => query);
  query.sort = jest.fn(() => query);
  query.skip = jest.fn(() => query);
  query.limit = jest.fn(() => query);
  query.exec = jest.fn(() => promise);
  query.then = promise.then.bind(promise);
  query.catch = promise.catch.bind(promise);
  query.finally = promise.finally?.bind(promise);
  return query;
}

function makeMockVehicle(overrides = {}) {
  return {
    _id: '507f1f77bcf86cd799439001',
    vehicleId: 'VEH-001',
    licensePlate: 'ABC-123',
    vin: '1HGBH41JXMN109186',
    type: 'truck',
    make: 'Volvo',
    model: 'FH16',
    year: 2023,
    organizationId: null,
    isActive: true,
    ...overrides,
    save: jest.fn().mockResolvedValue(undefined),
    toJSON: jest.fn().mockReturnValue({
      _id: '507f1f77bcf86cd799439001',
      vehicleId: 'VEH-001',
      licensePlate: 'ABC-123',
    }),
    toObject: jest.fn().mockReturnValue({
      _id: '507f1f77bcf86cd799439001',
      vehicleId: 'VEH-001',
    }),
  };
}

// Use jest.fn() as a constructor so we get mockImplementation / mockReturnValue
// on it too. The implementation preserves class-like behaviour (assigns
// makeMockUser defaults + the caller's data to `this`).
const MockVehicle = jest.fn(function MockVehicle(data) {
  const inst = makeMockVehicle(data || {});
  Object.assign(this, inst);
  if (data) {
    Object.keys(data).forEach((k) => { this[k] = data[k]; });
  }
});
MockVehicle.modelName = 'Vehicle';
MockVehicle.find = jest.fn();
MockVehicle.findOne = jest.fn();
MockVehicle.findById = jest.fn();
MockVehicle.findByIdAndUpdate = jest.fn();
MockVehicle.findOneAndUpdate = jest.fn();
MockVehicle.updateOne = jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 });
MockVehicle.deleteOne = jest.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 });
MockVehicle.countDocuments = jest.fn().mockResolvedValue(0);

jest.unstable_mockModule('../../src/models/Vehicle.js', () => ({ default: MockVehicle }));

// ─── Mock AuditLog (recordAudit would otherwise try MongoDB) ───────────────
jest.unstable_mockModule('../../src/models/AuditLog.js', () => ({
  default: { create: jest.fn().mockResolvedValue({}), modelName: 'AuditLog' },
  recordAudit: jest.fn().mockResolvedValue(undefined),
  sanitizeForLog: (obj) => obj,
}));

// ─── Dynamic imports (must come AFTER unstable_mockModule calls) ───────────
let request, createApp, app;

beforeAll(async () => {
  request = (await import('supertest')).default;
  createApp = (await import('../helpers/app.js')).createApp;
  app = createApp();
});

beforeEach(() => {
  jest.clearAllMocks();
  // Reset default mock user (fleet_manager with read+write but no delete)
  mockAuthState.user = {
    _id: '507f1f77bcf86cd7994390aa',
    role: 'fleet_manager',
    email: 'fleet@example.com',
    organizationId: null,
  };
});

// ─── Tests ─────────────────────────────────────────────────────────────────
describe('Vehicle routes — GET /api/v1/vehicles (list)', () => {
  test('returns 200 with a paginated vehicle list', async () => {
    const mockVehicles = [
      makeMockVehicle({ vehicleId: 'VEH-001', licensePlate: 'AAA-111' }),
      makeMockVehicle({ vehicleId: 'VEH-002', licensePlate: 'BBB-222' }),
    ];
    MockVehicle.find.mockReturnValue(chainableQuery(mockVehicles));
    MockVehicle.countDocuments.mockResolvedValue(2);

    const res = await request(app).get('/api/v1/vehicles');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination).toHaveProperty('page');
    expect(res.body.pagination).toHaveProperty('limit');
    expect(res.body.pagination).toHaveProperty('total');
    expect(res.body.pagination).toHaveProperty('pages');
    expect(res.body.pagination.total).toBe(2);
  });

  test('passes through query params for pagination (page, limit)', async () => {
    MockVehicle.find.mockReturnValue(chainableQuery([]));
    MockVehicle.countDocuments.mockResolvedValue(0);

    const res = await request(app).get('/api/v1/vehicles?page=2&limit=10');

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(10);
    // Verify the query was built with skip and limit
    expect(MockVehicle.find).toHaveBeenCalled();
    // The chainable query's sort/skip/limit should have been called
    const queryObj = MockVehicle.find.mock.results[0].value;
    expect(queryObj.skip).toHaveBeenCalled();
    expect(queryObj.limit).toHaveBeenCalled();
  });

  test('handles an empty result set gracefully', async () => {
    MockVehicle.find.mockReturnValue(chainableQuery([]));
    MockVehicle.countDocuments.mockResolvedValue(0);

    const res = await request(app).get('/api/v1/vehicles');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
    expect(res.body.pagination.pages).toBe(0);
  });
});

describe('Vehicle routes — GET /api/v1/vehicles/:id', () => {
  test('returns 404 when the vehicle is not found', async () => {
    MockVehicle.findOne.mockReturnValue(chainableQuery(null));

    const res = await request(app).get('/api/v1/vehicles/507f1f77bcf86cd799439001');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  test('returns 400 for an invalid ObjectId', async () => {
    const res = await request(app).get('/api/v1/vehicles/not-a-valid-id');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid id/i);
  });

  test('returns 200 with the vehicle when found', async () => {
    const mockVehicle = makeMockVehicle({ vehicleId: 'VEH-001' });
    MockVehicle.findOne.mockReturnValue(chainableQuery(mockVehicle));

    const res = await request(app).get('/api/v1/vehicles/507f1f77bcf86cd799439001');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('vehicleId', 'VEH-001');
  });
});

describe('Vehicle routes — POST /api/v1/vehicles (create)', () => {
  test('returns 403 for a driver (no vehicles:write permission)', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390bb',
      role: 'driver',
      email: 'driver@example.com',
      organizationId: null,
    };

    const res = await request(app).post('/api/v1/vehicles').send({
      vehicleId: 'VEH-NEW',
      licensePlate: 'XYZ-999',
      type: 'truck',
      make: 'Volvo',
      model: 'FH16',
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/permission|denied/i);
  });

  test('returns 403 for a read_only_user (no vehicles:write)', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390cc',
      role: 'read_only_user',
      email: 'reader@example.com',
      organizationId: null,
    };

    const res = await request(app).post('/api/v1/vehicles').send({
      vehicleId: 'VEH-NEW',
      licensePlate: 'XYZ-999',
      type: 'truck',
      make: 'Volvo',
      model: 'FH16',
    });

    expect(res.status).toBe(403);
  });

  test('returns 201 on valid input (fleet_manager has vehicles:write)', async () => {
    const mockVehicle = makeMockVehicle({ vehicleId: 'VEH-NEW' });
    // Mock the constructor to return our mock instance
    MockVehicle.mockImplementation(function (data) {
      Object.assign(this, mockVehicle, data);
      this.save = jest.fn().mockResolvedValue(undefined);
      this.toJSON = jest.fn().mockReturnValue({ ...mockVehicle, ...data });
    });

    const res = await request(app).post('/api/v1/vehicles').send({
      vehicleId: 'VEH-NEW',
      licensePlate: 'XYZ-999',
      type: 'truck',
      make: 'Volvo',
      model: 'FH16',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('data');
    expect(res.body.message).toMatch(/created/i);
  });

  test('returns 201 for super_admin (bypasses permission check)', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390dd',
      role: 'super_admin',
      email: 'admin@example.com',
      organizationId: null,
    };

    const mockVehicle = makeMockVehicle({ vehicleId: 'VEH-ADMIN' });
    MockVehicle.mockImplementation(function (data) {
      Object.assign(this, mockVehicle, data);
      this.save = jest.fn().mockResolvedValue(undefined);
      this.toJSON = jest.fn().mockReturnValue({ ...mockVehicle, ...data });
    });

    const res = await request(app).post('/api/v1/vehicles').send({
      vehicleId: 'VEH-ADMIN',
      licensePlate: 'ADMIN-1',
      type: 'truck',
      make: 'Volvo',
      model: 'FH16',
    });

    expect(res.status).toBe(201);
  });
});

describe('Vehicle routes — DELETE /api/v1/vehicles/:id', () => {
  test('returns 404 when the vehicle is not found', async () => {
    // Use super_admin to bypass the vehicles:delete permission check
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390dd',
      role: 'super_admin',
      email: 'admin@example.com',
      organizationId: null,
    };

    // Mock: findOne returns null (vehicle doesn't exist)
    MockVehicle.findOne.mockReturnValue(chainableQuery(null));

    const res = await request(app).delete('/api/v1/vehicles/507f1f77bcf86cd799439001');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  test('returns 403 for fleet_manager (no vehicles:delete permission)', async () => {
    // fleet_manager has vehicles:read and vehicles:write but NOT vehicles:delete
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390aa',
      role: 'fleet_manager',
      email: 'fleet@example.com',
      organizationId: null,
    };

    const res = await request(app).delete('/api/v1/vehicles/507f1f77bcf86cd799439001');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 (soft delete) when super_admin deletes an existing vehicle', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390dd',
      role: 'super_admin',
      email: 'admin@example.com',
      organizationId: null,
    };

    // Mock: findOne returns an existing vehicle (with isActive, so soft delete)
    const existingVehicle = makeMockVehicle({ isActive: true });
    MockVehicle.findOne.mockReturnValue(chainableQuery(existingVehicle));
    MockVehicle.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });

    const res = await request(app).delete('/api/v1/vehicles/507f1f77bcf86cd799439001');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/deleted/i);
    // Verify updateOne was called (soft delete)
    expect(MockVehicle.updateOne).toHaveBeenCalled();
  });
});

describe('Vehicle routes — RBAC matrix', () => {
  test('read_only_user can GET /vehicles (has vehicles:read)', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390cc',
      role: 'read_only_user',
      email: 'reader@example.com',
      organizationId: null,
    };

    MockVehicle.find.mockReturnValue(chainableQuery([]));
    MockVehicle.countDocuments.mockResolvedValue(0);

    const res = await request(app).get('/api/v1/vehicles');
    expect(res.status).toBe(200);
  });

  test('read_only_user CANNOT POST /vehicles (no vehicles:write)', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390cc',
      role: 'read_only_user',
      email: 'reader@example.com',
      organizationId: null,
    };

    const res = await request(app).post('/api/v1/vehicles').send({
      vehicleId: 'VEH-X',
      licensePlate: 'X-1',
      type: 'truck',
      make: 'Volvo',
      model: 'FH',
    });
    expect(res.status).toBe(403);
  });

  test('mechanic can GET /vehicles but CANNOT POST', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390ee',
      role: 'mechanic',
      email: 'mech@example.com',
      organizationId: null,
    };

    MockVehicle.find.mockReturnValue(chainableQuery([]));
    MockVehicle.countDocuments.mockResolvedValue(0);

    const getRes = await request(app).get('/api/v1/vehicles');
    expect(getRes.status).toBe(200);

    const postRes = await request(app).post('/api/v1/vehicles').send({
      vehicleId: 'VEH-X',
      licensePlate: 'X-1',
      type: 'truck',
      make: 'Volvo',
      model: 'FH',
    });
    expect(postRes.status).toBe(403);
  });
});

describe('Vehicle routes — PUT /api/v1/vehicles/:id (update)', () => {
  test('returns 404 when the vehicle is not found', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390dd',
      role: 'super_admin',
      email: 'admin@example.com',
      organizationId: null,
    };

    MockVehicle.findOne.mockReturnValue(chainableQuery(null));

    const res = await request(app)
      .put('/api/v1/vehicles/507f1f77bcf86cd799439001')
      .send({ color: 'red' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 for an invalid ObjectId', async () => {
    const res = await request(app)
      .put('/api/v1/vehicles/not-a-valid-id')
      .send({ color: 'red' });
    expect(res.status).toBe(400);
  });

  test('returns 200 and the updated vehicle on success', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390aa',
      role: 'fleet_manager',
      email: 'fleet@example.com',
      organizationId: null,
    };

    const existingVehicle = makeMockVehicle({ vehicleId: 'VEH-001', color: 'blue' });
    const updatedVehicle = makeMockVehicle({ vehicleId: 'VEH-001', color: 'red' });

    // crudFactory calls findOne(...).lean() for the "before" snapshot,
    // then findOneAndUpdate(...) for the actual update.
    MockVehicle.findOne.mockReturnValue(chainableQuery(existingVehicle));
    MockVehicle.findOneAndUpdate.mockResolvedValue(updatedVehicle);

    const res = await request(app)
      .put('/api/v1/vehicles/507f1f77bcf86cd799439001')
      .send({ color: 'red' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/updated/i);
  });

  test('strips organizationId from the update body (never allow tenant change)', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390aa',
      role: 'fleet_manager',
      email: 'fleet@example.com',
      organizationId: null,
    };

    const existingVehicle = makeMockVehicle();
    MockVehicle.findOne.mockReturnValue(chainableQuery(existingVehicle));
    MockVehicle.findOneAndUpdate.mockResolvedValue(existingVehicle);

    await request(app)
      .put('/api/v1/vehicles/507f1f77bcf86cd799439001')
      .send({ color: 'red', organizationId: '507f1f77bcf86cd799439099' });

    // Verify findOneAndUpdate was called WITHOUT organizationId in the update
    const updateCall = MockVehicle.findOneAndUpdate.mock.calls[0];
    const updateObj = updateCall[1]; // second arg is the update object
    expect(updateObj).not.toHaveProperty('organizationId');
    expect(updateObj.color).toBe('red');
  });
});

describe('Vehicle routes — additional endpoints', () => {
  test('GET /:id/history returns 404 when vehicle not found', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390aa',
      role: 'fleet_manager',
      email: 'fleet@example.com',
      organizationId: null,
    };

    MockVehicle.findOne.mockReturnValue(chainableQuery(null));

    const res = await request(app).get('/api/v1/vehicles/507f1f77bcf86cd799439001/history');
    expect(res.status).toBe(404);
  });

  test('GET /:id/history returns 200 with history data when found', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390aa',
      role: 'fleet_manager',
      email: 'fleet@example.com',
      organizationId: null,
    };

    const mockVehicle = makeMockVehicle({
      events: [{ type: 'created', timestamp: new Date() }],
      assignmentHistory: [],
    });
    // history route calls findOne(...).select(...)
    const query = chainableQuery(mockVehicle);
    MockVehicle.findOne.mockReturnValue(query);

    const res = await request(app).get('/api/v1/vehicles/507f1f77bcf86cd799439001/history');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  test('PUT /:id/location returns 400 when latitude/longitude are missing', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390bb',
      role: 'driver',
      email: 'driver@example.com',
      organizationId: null,
    };

    const res = await request(app)
      .put('/api/v1/vehicles/507f1f77bcf86cd799439001/location')
      .send({ address: 'somewhere' });

    expect(res.status).toBe(400);
  });

  test('PUT /:id/location returns 404 when vehicle not found', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390bb',
      role: 'driver',
      email: 'driver@example.com',
      organizationId: null,
    };

    MockVehicle.findOne.mockReturnValue(chainableQuery(null));

    const res = await request(app)
      .put('/api/v1/vehicles/507f1f77bcf86cd799439001/location')
      .send({ latitude: 40.7128, longitude: -74.006 });

    expect(res.status).toBe(404);
  });

  test('PUT /:id/location returns 200 with updated location', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390bb',
      role: 'driver',
      email: 'driver@example.com',
      organizationId: null,
    };

    const mockVehicle = makeMockVehicle();
    mockVehicle.save = jest.fn().mockResolvedValue(undefined);
    MockVehicle.findOne.mockReturnValue(chainableQuery(mockVehicle));

    const res = await request(app)
      .put('/api/v1/vehicles/507f1f77bcf86cd799439001/location')
      .send({ latitude: 40.7128, longitude: -74.006, address: 'NYC' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('latitude', 40.7128);
    expect(res.body.data).toHaveProperty('longitude', -74.006);
  });

  test('POST /:id/retire returns 404 when vehicle not found', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390aa',
      role: 'fleet_manager',
      email: 'fleet@example.com',
      organizationId: null,
    };

    MockVehicle.findOne.mockReturnValue(chainableQuery(null));

    const res = await request(app)
      .post('/api/v1/vehicles/507f1f77bcf86cd799439001/retire')
      .send({ reason: 'old age' });

    expect(res.status).toBe(404);
  });

  test('POST /:id/retire returns 200 when vehicle is retired', async () => {
    mockAuthState.user = {
      _id: '507f1f77bcf86cd7994390aa',
      role: 'fleet_manager',
      email: 'fleet@example.com',
      organizationId: null,
    };

    const mockVehicle = makeMockVehicle();
    mockVehicle.retire = jest.fn().mockResolvedValue(undefined);
    MockVehicle.findOne.mockReturnValue(chainableQuery(mockVehicle));

    const res = await request(app)
      .post('/api/v1/vehicles/507f1f77bcf86cd799439001/retire')
      .send({ reason: 'end of life' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockVehicle.retire).toHaveBeenCalled();
  });
});
