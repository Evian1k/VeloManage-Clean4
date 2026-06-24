/**
 * Integration tests for enterprise module routes built with createCrudRouter.
 *
 * Covers the simpler modules (those whose route file imports only the primary
 * model plus the shared crudFactory / rbac / tenant helpers):
 *   staff, trips, assets, compliance, accidents, geofences
 *
 * Each module route is mounted on a minimal Express app and exercised via
 * GET / (list), GET /:invalid-id (400), and GET /:id (404).
 *
 * Note: we use super_admin for the mock user so the requirePermission check
 * is bypassed — this lets us test the CRUD factory behaviour uniformly
 * across modules without per-module permission configuration.
 *
 * Note: Organization is intentionally NOT mocked — mocking it causes
 * jest.unstable_mockModule to hang (likely a circular-dependency issue
 * with tenant.js). The real Organization model loads fine; since the mock
 * user has organizationId: null, attachTenant never calls Organization.findById.
 */
import { jest, describe, test, expect, beforeAll, beforeEach } from '@jest/globals';

const mockAuthState = {
  user: {
    _id: '507f1f77bcf86cd7994390aa',
    role: 'super_admin',
    email: 'admin@example.com',
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

function makeMockModel(name) {
  const Model = jest.fn(function (data) {
    Object.assign(this, data || {});
    this.save = jest.fn().mockResolvedValue(undefined);
    this.toJSON = jest.fn().mockReturnValue({ _id: '507f1f77bcf86cd799439001' });
    this.toObject = jest.fn().mockReturnValue({ _id: '507f1f77bcf86cd799439001' });
  });
  Model.modelName = name;
  Model.find = jest.fn().mockReturnValue(chainableQuery([]));
  Model.findOne = jest.fn().mockReturnValue(chainableQuery(null));
  Model.findById = jest.fn().mockReturnValue(chainableQuery(null));
  Model.findOneAndUpdate = jest.fn().mockResolvedValue(null);
  Model.updateOne = jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 });
  Model.deleteOne = jest.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 });
  Model.countDocuments = jest.fn().mockResolvedValue(0);
  return Model;
}

const M = {
  Staff: makeMockModel('Staff'),
  Trip: makeMockModel('Trip'),
  Asset: makeMockModel('Asset'),
  Compliance: makeMockModel('Compliance'),
  Accident: makeMockModel('Accident'),
  Geofence: makeMockModel('Geofence'),
  Vehicle: makeMockModel('Vehicle'), // imported by geofences.js
};

jest.unstable_mockModule('../../src/models/Staff.js', () => ({ default: M.Staff }));
jest.unstable_mockModule('../../src/models/Trip.js', () => ({ default: M.Trip }));
jest.unstable_mockModule('../../src/models/Asset.js', () => ({ default: M.Asset }));
jest.unstable_mockModule('../../src/models/Compliance.js', () => ({ default: M.Compliance }));
jest.unstable_mockModule('../../src/models/Accident.js', () => ({ default: M.Accident }));
jest.unstable_mockModule('../../src/models/Geofence.js', () => ({ default: M.Geofence }));
jest.unstable_mockModule('../../src/models/Vehicle.js', () => ({ default: M.Vehicle }));
jest.unstable_mockModule('../../src/models/AuditLog.js', () => ({
  default: { create: jest.fn().mockResolvedValue({}), modelName: 'AuditLog' },
  recordAudit: jest.fn().mockResolvedValue(undefined),
  sanitizeForLog: (obj) => obj,
}));

let request;
let mods = {};

beforeAll(async () => {
  request = (await import('supertest')).default;
  const express = (await import('express')).default;
  const helmet = (await import('helmet')).default;
  const cors = (await import('cors')).default;
  const { attachTenant } = await import('../../src/middleware/tenant.js');
  const { errorHandler } = await import('../../src/middleware/errorHandler.js');
  const { authenticateToken } = await import('../../src/middleware/auth.js');

  mods.express = express;
  mods.helmet = helmet;
  mods.cors = cors;
  mods.attachTenant = attachTenant;
  mods.errorHandler = errorHandler;
  mods.authenticateToken = authenticateToken;

  mods.routes = {
    staff: (await import('../../src/routes/modules/staff.js')).default,
    trips: (await import('../../src/routes/modules/trips.js')).default,
    assets: (await import('../../src/routes/modules/assets.js')).default,
    compliance: (await import('../../src/routes/modules/compliance.js')).default,
    accidents: (await import('../../src/routes/modules/accidents.js')).default,
    geofences: (await import('../../src/routes/modules/geofences.js')).default,
  };
}, 30000);

beforeEach(() => {
  for (const model of Object.values(M)) {
    model.find.mockReturnValue(chainableQuery([]));
    model.findOne.mockReturnValue(chainableQuery(null));
    model.countDocuments.mockResolvedValue(0);
  }
});

function buildApp(router) {
  const app = mods.express();
  app.use(mods.helmet());
  app.use(mods.cors({ origin: true, credentials: true }));
  app.use(mods.express.json());
  app.set('trust proxy', 1);
  app.use('/api/v1/x', mods.authenticateToken, mods.attachTenant, router);
  app.use('*', (req, res) => res.status(404).json({ success: false, error: 'Route not found' }));
  app.use(mods.errorHandler);
  return app;
}

describe('Module routes — CRUD via createCrudRouter', () => {
  const cases = [
    ['staff', 'Staff'],
    ['trips', 'Trip'],
    ['assets', 'Asset'],
    ['compliance', 'Compliance'],
    ['accidents', 'Accident'],
    ['geofences', 'Geofence'],
  ];

  test.each(cases)('%s: GET / returns 200 with paginated list', async (routeName, modelName) => {
    const app = buildApp(mods.routes[routeName]);
    const res = await request(app).get('/api/v1/x');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(M[modelName].find).toHaveBeenCalled();
  });

  test.each(cases)('%s: GET /:invalid-id returns 400', async (routeName) => {
    const app = buildApp(mods.routes[routeName]);
    const res = await request(app).get('/api/v1/x/not-an-object-id');
    expect(res.status).toBe(400);
  });

  test.each(cases)('%s: GET /:id returns 404 when not found', async (routeName, modelName) => {
    M[modelName].findOne.mockReturnValue(chainableQuery(null));
    const app = buildApp(mods.routes[routeName]);
    const res = await request(app).get('/api/v1/x/507f1f77bcf86cd799439001');
    expect(res.status).toBe(404);
  });
});
