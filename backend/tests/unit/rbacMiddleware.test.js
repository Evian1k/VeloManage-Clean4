/**
 * Unit tests for the RBAC middleware: requirePermission, requireRole,
 * requireAnyPermission, requireAllPermissions.
 *
 * Covers src/middleware/rbac.js
 *
 * These middleware functions are pure (they just inspect req.user and call
 * next() or send a 403). No DB access, no mocking required.
 */
import { describe, test, expect, jest } from '@jest/globals';

import {
  requirePermission,
  requireRole,
  requireAnyPermission,
  requireAllPermissions,
} from '../../src/middleware/rbac.js';
import { ROLES } from '../../src/config/rbac.js';

// Helper: build a minimal req/res/next triplet
function makeReqResNext(user) {
  const req = { user };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('requirePermission', () => {
  test('calls next() when the user has the required permission', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.FLEET_MANAGER });
    const middleware = requirePermission('vehicles:write');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 403 when the user lacks the required permission', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.DRIVER });
    const middleware = requirePermission('vehicles:write');
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('vehicles:write'),
      }),
    );
  });

  test('returns 401 when no user is attached to the request', () => {
    const { req, res, next } = makeReqResNext(undefined);
    const middleware = requirePermission('vehicles:read');
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('super_admin bypasses the permission check (PLATFORM_ROLES)', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.SUPER_ADMIN });
    const middleware = requirePermission('anything:whatever');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('platform_owner also bypasses', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.PLATFORM_OWNER });
    const middleware = requirePermission('anything:whatever');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('read_only_user is denied write permissions', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.READ_ONLY_USER });
    const middleware = requirePermission('vehicles:write');
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('read_only_user is granted read permissions', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.READ_ONLY_USER });
    const middleware = requirePermission('vehicles:read');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('the 403 response includes the user\'s role for debugging', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.DRIVER });
    const middleware = requirePermission('vehicles:delete');
    middleware(req, res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ your_role: ROLES.DRIVER }),
    );
  });
});

describe('requireRole', () => {
  test('calls next() when the user has one of the allowed roles (single role string)', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.FLEET_MANAGER });
    const middleware = requireRole(ROLES.FLEET_MANAGER);
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('calls next() when the user has one of the allowed roles (array)', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.OPERATIONS_MANAGER });
    const middleware = requireRole([ROLES.FLEET_MANAGER, ROLES.OPERATIONS_MANAGER]);
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 403 when the user\'s role is not in the allowed list', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.DRIVER });
    const middleware = requireRole([ROLES.FLEET_MANAGER, ROLES.OPERATIONS_MANAGER]);
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Fleet Manager'),
      }),
    );
  });

  test('returns 401 when no user is attached', () => {
    const { req, res, next } = makeReqResNext(undefined);
    const middleware = requireRole(ROLES.FLEET_MANAGER);
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('super_admin bypasses the role check', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.SUPER_ADMIN });
    const middleware = requireRole(ROLES.FLEET_MANAGER);
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireAnyPermission', () => {
  test('calls next() when the user has at least one of the listed permissions', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.DRIVER });
    // driver has gps:write but not vehicles:delete
    const middleware = requireAnyPermission(['vehicles:delete', 'gps:write']);
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 403 when the user has none of the listed permissions', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.DRIVER });
    const middleware = requireAnyPermission(['vehicles:delete', 'finance:approve']);
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('vehicles:delete'),
      }),
    );
  });

  test('returns 401 when no user is attached', () => {
    const { req, res, next } = makeReqResNext(undefined);
    const middleware = requireAnyPermission(['vehicles:read']);
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('super_admin bypasses', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.SUPER_ADMIN });
    const middleware = requireAnyPermission(['nonexistent:perm']);
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireAllPermissions', () => {
  test('calls next() when the user has ALL listed permissions', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.FLEET_MANAGER });
    // fleet_manager has vehicles:read, vehicles:write, maintenance:approve
    const middleware = requireAllPermissions([
      'vehicles:read', 'vehicles:write', 'maintenance:approve',
    ]);
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 403 when the user is missing ANY permission', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.FLEET_MANAGER });
    // fleet_manager does NOT have vehicles:delete
    const middleware = requireAllPermissions([
      'vehicles:read', 'vehicles:delete',
    ]);
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('vehicles:delete'),
      }),
    );
  });

  test('returns 401 when no user is attached', () => {
    const { req, res, next } = makeReqResNext(undefined);
    const middleware = requireAllPermissions(['vehicles:read']);
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('super_admin bypasses even if it would lack a permission', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.SUPER_ADMIN });
    const middleware = requireAllPermissions(['nonexistent:perm1', 'nonexistent:perm2']);
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('error message lists ALL missing permissions', () => {
    const { req, res, next } = makeReqResNext({ role: ROLES.DRIVER });
    const middleware = requireAllPermissions(['vehicles:delete', 'finance:approve']);
    middleware(req, res, next);
    const call = res.json.mock.calls[0][0];
    expect(call.message).toContain('vehicles:delete');
    expect(call.message).toContain('finance:approve');
  });
});
