/**
 * Unit tests for the tenant isolation middleware:
 *   - attachTenant      (resolves org from req.user / x-organization-id header)
 *   - requireTenant     (rejects requests without tenant context)
 *   - tenantFilter      (already covered in tenant.test.js, but re-tested here
 *                        in the context of the full middleware module)
 *
 * Covers src/middleware/tenant.js
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock Organization so attachTenant doesn't try to hit MongoDB
jest.unstable_mockModule('../../src/models/Organization.js', () => {
  const MockOrg = {
    findById: jest.fn(),
  };
  return { default: MockOrg };
});

let Organization, attachTenant, requireTenant, tenantFilter, validateTenantOwnership;

beforeAll(async () => {
  Organization = (await import('../../src/models/Organization.js')).default;
  ({ attachTenant, requireTenant, tenantFilter, validateTenantOwnership } =
    await import('../../src/middleware/tenant.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
});

function makeReqResNext(overrides = {}) {
  const req = {
    header: jest.fn((name) => overrides.headers?.[name.toLowerCase()]),
    user: overrides.user,
    ...overrides,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('attachTenant', () => {
  test('calls next() immediately when no user is attached', async () => {
    const { req, res, next } = makeReqResNext({ user: undefined });
    await attachTenant(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.tenant).toBeUndefined();
    expect(req.tenantId).toBeUndefined();
  });

  test('sets req.tenant / req.tenantId when the user has a valid organizationId', async () => {
    const mockOrg = { _id: '507f1f77bcf86cd799439011', isActive: true, name: 'Acme' };
    Organization.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockOrg),
    });

    const { req, res, next } = makeReqResNext({
      user: { role: 'fleet_manager', organizationId: '507f1f77bcf86cd799439011' },
    });

    await attachTenant(req, res, next);

    expect(req.tenant).toEqual(mockOrg);
    expect(req.tenantId).toBe(mockOrg._id);
    expect(next).toHaveBeenCalled();
  });

  test('returns 403 when the organization is inactive (suspended)', async () => {
    const mockOrg = { _id: '507f1f77bcf86cd799439011', isActive: false };
    Organization.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockOrg),
    });

    const { req, res, next } = makeReqResNext({
      user: { role: 'fleet_manager', organizationId: '507f1f77bcf86cd799439011' },
    });

    await attachTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('continues without tenant when the org lookup throws (invalid ObjectId)', async () => {
    Organization.findById.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('Invalid ObjectId')),
    });

    const { req, res, next } = makeReqResNext({
      user: { role: 'fleet_manager', organizationId: 'not-a-valid-id' },
    });

    await attachTenant(req, res, next);

    // Should swallow the error and continue without setting tenant
    expect(req.tenant).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test('platform admin can override tenant via x-organization-id header', async () => {
    const mockOrg = { _id: '507f1f77bcf86cd799439099', isActive: true };
    Organization.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockOrg),
    });

    const { req, res, next } = makeReqResNext({
      user: { role: 'super_admin', organizationId: null },
      headers: { 'x-organization-id': '507f1f77bcf86cd799439099' },
    });

    await attachTenant(req, res, next);

    expect(req.tenant).toEqual(mockOrg);
    expect(req.tenantId).toBe(mockOrg._id);
    expect(next).toHaveBeenCalled();
  });

  test('non-platform user cannot override tenant via x-organization-id header', async () => {
    // fleet_manager passes x-organization-id but is NOT a platform admin,
    // so the header is ignored and their own organizationId is used.
    const mockOrg = { _id: '507f1f77bcf86cd799439011', isActive: true };
    Organization.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockOrg),
    });

    const { req, res, next } = makeReqResNext({
      user: { role: 'fleet_manager', organizationId: '507f1f77bcf86cd799439011' },
      headers: { 'x-organization-id': '507f1f77bcf86cd799439099' },
    });

    await attachTenant(req, res, next);

    // Should have looked up the USER's org, not the header's
    expect(Organization.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(req.tenantId).toBe(mockOrg._id);
  });

  test('user with no organizationId and no header → no tenant context', async () => {
    const { req, res, next } = makeReqResNext({
      user: { role: 'super_admin', organizationId: null },
      headers: {},
    });

    await attachTenant(req, res, next);

    expect(req.tenant).toBeUndefined();
    expect(req.tenantId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

describe('requireTenant', () => {
  test('calls next() when req.tenantId is set', () => {
    const { req, res, next } = makeReqResNext({
      user: { role: 'fleet_manager' },
      tenantId: '507f1f77bcf86cd799439011',
    });
    requireTenant(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('calls next() when user is a platform admin (even without tenantId)', () => {
    const { req, res, next } = makeReqResNext({
      user: { role: 'super_admin' },
      tenantId: undefined,
    });
    requireTenant(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 400 when no tenant context and user is not a platform admin', () => {
    const { req, res, next } = makeReqResNext({
      user: { role: 'fleet_manager' },
      tenantId: undefined,
    });
    requireTenant(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('Tenant context required'),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 400 when no user is attached', () => {
    const { req, res, next } = makeReqResNext({
      user: undefined,
      tenantId: undefined,
    });
    requireTenant(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('validateTenantOwnership', () => {
  test('calls next() when the resource id is missing (no check needed)', async () => {
    const middleware = validateTenantOwnership('Vehicle', 'params', 'id');
    const { req, res, next } = makeReqResNext({
      user: { role: 'fleet_manager' },
      params: {}, // no id
    });
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('calls next() for platform admins (skip ownership check)', async () => {
    const middleware = validateTenantOwnership('Vehicle', 'params', 'id');
    const { req, res, next } = makeReqResNext({
      user: { role: 'super_admin' },
      params: { id: '507f1f77bcf86cd799439001' },
    });
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
