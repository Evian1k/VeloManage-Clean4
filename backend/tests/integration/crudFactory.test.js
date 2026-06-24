/**
 * Integration tests for the createCrudRouter factory's query features.
 *
 * The vehicles route (src/routes/modules/vehicles.js) is built with
 * createCrudRouter, so we exercise the factory's LIST handler through it.
 * Focus is on the branches that vehicles.test.js does NOT cover:
 *   - search (?search=...)               → builds a $or filter
 *   - field-specific filters             → true / false / ObjectId / comma-list / plain string
 *   - sort (?sort=field / ?sort=-field)  → asc / desc
 *   - populate (?populate=field,field)   → custom population list
 *   - fields (?fields=a,b,c)             → field selection
 *   - pagination edges (page=0, limit=0, limit>max)
 *
 * Mocks mirror vehicles.test.js so the same chainable-query helper works.
 */
import { jest, describe, test, expect, beforeAll, beforeEach } from '@jest/globals';

// ─── Configurable mock auth state ──────────────────────────────────────────
const mockAuthState = {
  user: {
    _id: '507f1f77bcf86cd7994390aa',
    role: 'fleet_manager',
    email: 'fleet@example.com',
    organizationId: null,
  },
};

jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  authenticateToken: (req, res, next) => {
    req.user = mockAuthState.user;
    next();
  },
  requireAdmin: (req, res, next) => next(),
  requireMainAdmin: (req, res, next) => next(),
  requireOwnershipOrAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
}));

// ─── Chainable query mock (same shape as vehicles.test.js) ─────────────────
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
    type: 'truck',
    make: 'Volvo',
    model: 'FH16',
    organizationId: null,
    isActive: true,
    ...overrides,
    save: jest.fn().mockResolvedValue(undefined),
    toJSON: jest.fn().mockReturnValue({ _id: '507f1f77bcf86cd799439001', vehicleId: 'VEH-001' }),
    toObject: jest.fn().mockReturnValue({ _id: '507f1f77bcf86cd799439001', vehicleId: 'VEH-001' }),
  };
}

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

jest.unstable_mockModule('../../src/models/AuditLog.js', () => ({
  default: { create: jest.fn().mockResolvedValue({}), modelName: 'AuditLog' },
  recordAudit: jest.fn().mockResolvedValue(undefined),
  sanitizeForLog: (obj) => obj,
}));

// ─── Dynamic imports (AFTER unstable_mockModule) ───────────────────────────
let request, createApp, app;

beforeAll(async () => {
  request = (await import('supertest')).default;
  createApp = (await import('../helpers/app.js')).createApp;
  app = createApp();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthState.user = {
    _id: '507f1f77bcf86cd7994390aa',
    role: 'fleet_manager',
    email: 'fleet@example.com',
    organizationId: null,
  };
});

// ─── Tests ─────────────────────────────────────────────────────────────────
describe('crudFactory — LIST query features', () => {
  test('?search= builds a $or filter across searchableFields', async () => {
    MockVehicle.find.mockReturnValue(chainableQuery([]));
    MockVehicle.countDocuments.mockResolvedValue(0);

    const res = await request(app).get('/api/v1/vehicles?search=volvo');

    expect(res.status).toBe(200);
    // The find() call should have received a filter with $or
    const filterArg = MockVehicle.find.mock.calls[0][0];
    expect(filterArg).toHaveProperty('$or');
    expect(Array.isArray(filterArg.$or)).toBe(true);
    expect(filterArg.$or.length).toBeGreaterThan(0);
  });

  test('?status=active applies a field-specific string filter', async () => {
    MockVehicle.find.mockReturnValue(chainableQuery([]));
    MockVehicle.countDocuments.mockResolvedValue(0);

    await request(app).get('/api/v1/vehicles?status=active');

    const filterArg = MockVehicle.find.mock.calls[0][0];
    expect(filterArg.status).toBe('active');
  });

  test('?isActive=true coerces "true" to boolean true', async () => {
    MockVehicle.find.mockReturnValue(chainableQuery([]));
    MockVehicle.countDocuments.mockResolvedValue(0);

    await request(app).get('/api/v1/vehicles?isActive=true');

    const filterArg = MockVehicle.find.mock.calls[0][0];
    expect(filterArg.isActive).toBe(true);
  });

  test('?isActive=false coerces "false" to boolean false', async () => {
    MockVehicle.find.mockReturnValue(chainableQuery([]));
    MockVehicle.countDocuments.mockResolvedValue(0);

    await request(app).get('/api/v1/vehicles?isActive=false');

    const filterArg = MockVehicle.find.mock.calls[0][0];
    expect(filterArg.isActive).toBe(false);
  });

  test('?branchId=<24-hex> is recognised as an ObjectId string', async () => {
    MockVehicle.find.mockReturnValue(chainableQuery([]));
    MockVehicle.countDocuments.mockResolvedValue(0);

    const objectId = '507f1f77bcf86cd799439099';
    await request(app).get(`/api/v1/vehicles?branchId=${objectId}`);

    const filterArg = MockVehicle.find.mock.calls[0][0];
    expect(filterArg.branchId).toBe(objectId);
  });

  test('?type=truck,trailer splits on comma into a $in filter', async () => {
    MockVehicle.find.mockReturnValue(chainableQuery([]));
    MockVehicle.countDocuments.mockResolvedValue(0);

    await request(app).get('/api/v1/vehicles?type=truck,trailer');

    const filterArg = MockVehicle.find.mock.calls[0][0];
    expect(filterArg.type).toEqual({ $in: ['truck', 'trailer'] });
  });

  test('?sort=-createdAt builds a descending sort object', async () => {
    MockVehicle.find.mockReturnValue(chainableQuery([]));
    MockVehicle.countDocuments.mockResolvedValue(0);

    await request(app).get('/api/v1/vehicles?sort=-createdAt');

    const queryObj = MockVehicle.find.mock.results[0].value;
    expect(queryObj.sort).toHaveBeenCalled();
    // sort() should have been called with { createdAt: -1 }
    const sortArg = queryObj.sort.mock.calls[0][0];
    expect(sortArg).toEqual({ createdAt: -1 });
  });

  test('?sort=year builds an ascending sort object', async () => {
    MockVehicle.find.mockReturnValue(chainableQuery([]));
    MockVehicle.countDocuments.mockResolvedValue(0);

    await request(app).get('/api/v1/vehicles?sort=year');

    const queryObj = MockVehicle.find.mock.results[0].value;
    const sortArg = queryObj.sort.mock.calls[0][0];
    expect(sortArg).toEqual({ year: 1 });
  });

  test('?fields=vehicleId,licensePlate applies field selection', async () => {
    MockVehicle.find.mockReturnValue(chainableQuery([]));
    MockVehicle.countDocuments.mockResolvedValue(0);

    await request(app).get('/api/v1/vehicles?fields=vehicleId,licensePlate');

    const queryObj = MockVehicle.find.mock.results[0].value;
    expect(queryObj.select).toHaveBeenCalledWith('vehicleId licensePlate');
  });

  test('?populate=assignedDriverId applies custom population', async () => {
    MockVehicle.find.mockReturnValue(chainableQuery([]));
    MockVehicle.countDocuments.mockResolvedValue(0);

    await request(app).get('/api/v1/vehicles?populate=assignedDriverId');

    const queryObj = MockVehicle.find.mock.results[0].value;
    expect(queryObj.populate).toHaveBeenCalled();
  });

  test('page=0 is clamped to 1 (Math.max)', async () => {
    MockVehicle.find.mockReturnValue(chainableQuery([]));
    MockVehicle.countDocuments.mockResolvedValue(0);

    const res = await request(app).get('/api/v1/vehicles?page=0&limit=5');

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
  });

  test('limit=999 is clamped to maxLimit (200)', async () => {
    MockVehicle.find.mockReturnValue(chainableQuery([]));
    MockVehicle.countDocuments.mockResolvedValue(0);

    const res = await request(app).get('/api/v1/vehicles?limit=999');

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(200);
  });

  test('pagination metadata includes hasNext / hasPrev', async () => {
    // 3 items, limit=2 → 2 pages, on page 1: hasNext=true, hasPrev=false
    MockVehicle.find.mockReturnValue(chainableQuery([makeMockVehicle(), makeMockVehicle()]));
    MockVehicle.countDocuments.mockResolvedValue(3);

    const res = await request(app).get('/api/v1/vehicles?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.pages).toBe(2);
    expect(res.body.pagination.hasNext).toBe(true);
    expect(res.body.pagination.hasPrev).toBe(false);
  });
});

describe('crudFactory — GET /:id branches', () => {
  test('returns 400 for a non-ObjectId param', async () => {
    const res = await request(app).get('/api/v1/vehicles/not-an-object-id');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
  });

  test('returns 404 when the document is not found', async () => {
    MockVehicle.findOne.mockReturnValue(chainableQuery(null));
    const res = await request(app).get('/api/v1/vehicles/507f1f77bcf86cd799439001');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  test('returns 200 with the document when found', async () => {
    const mockVehicle = makeMockVehicle({ vehicleId: 'VEH-X' });
    MockVehicle.findOne.mockReturnValue(chainableQuery(mockVehicle));
    const res = await request(app).get('/api/v1/vehicles/507f1f77bcf86cd799439001');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data._id).toBe('507f1f77bcf86cd799439001');
  });
});

describe('crudFactory — DELETE /:id branches', () => {
  test('returns 400 for a non-ObjectId param', async () => {
    // super_admin bypasses the delete-permission check
    mockAuthState.user.role = 'super_admin';
    const res = await request(app).delete('/api/v1/vehicles/not-an-object-id');
    expect(res.status).toBe(400);
  });

  test('returns 404 when the document is not found', async () => {
    mockAuthState.user.role = 'super_admin';
    MockVehicle.findOne.mockReturnValue(chainableQuery(null));
    const res = await request(app).delete('/api/v1/vehicles/507f1f77bcf86cd799439001');
    expect(res.status).toBe(404);
  });

  test('performs a HARD delete when before.isActive is undefined', async () => {
    mockAuthState.user.role = 'super_admin';
    // Mock: existing doc WITHOUT isActive → triggers Model.deleteOne path
    const docWithoutIsActive = { _id: '507f1f77bcf86cd799439001', organizationId: null };
    // findOne(...).lean() returns the doc
    MockVehicle.findOne.mockReturnValue(chainableQuery(docWithoutIsActive));
    MockVehicle.deleteOne.mockResolvedValue({ acknowledged: true, deletedCount: 1 });

    const res = await request(app).delete('/api/v1/vehicles/507f1f77bcf86cd799439001');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(MockVehicle.deleteOne).toHaveBeenCalled();
    // updateOne should NOT have been called (hard delete path)
    expect(MockVehicle.updateOne).not.toHaveBeenCalled();
  });
});
