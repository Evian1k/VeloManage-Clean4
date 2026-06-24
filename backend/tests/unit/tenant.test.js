/**
 * Unit tests for the tenant isolation helper.
 *
 * Covers: tenantFilter(req) from src/middleware/tenant.js
 *
 * tenantFilter is a pure function — it reads req.tenantId and returns a
 * mongoose filter object. No DB access, no mocking required.
 */
import { describe, test, expect } from '@jest/globals';

import { tenantFilter } from '../../src/middleware/tenant.js';

describe('tenantFilter', () => {
  test('returns { organizationId: tenantId } when req.tenantId is set', () => {
    const req = { tenantId: '507f1f77bcf86cd799439011' };
    expect(tenantFilter(req)).toEqual({
      organizationId: '507f1f77bcf86cd799439011',
    });
  });

  test('returns {} when req.tenantId is undefined (platform admin context)', () => {
    const req = {};
    expect(tenantFilter(req)).toEqual({});
  });

  test('returns {} when req.tenantId is null', () => {
    const req = { tenantId: null };
    expect(tenantFilter(req)).toEqual({});
  });

  test('returns {} when req is an empty object', () => {
    expect(tenantFilter({})).toEqual({});
  });

  test('spreads cleanly into a larger filter object', () => {
    const req = { tenantId: 'org-123' };
    const filter = { ...tenantFilter(req), status: 'active' };
    expect(filter).toEqual({
      organizationId: 'org-123',
      status: 'active',
    });
  });

  test('platform admin with no tenant context sees an empty filter (all tenants)', () => {
    // Simulate: super_admin logged in but no x-organization-id header set,
    // so attachTenant never sets req.tenantId.
    const req = {
      user: { role: 'super_admin' },
      // tenantId intentionally undefined
    };
    expect(tenantFilter(req)).toEqual({});
  });

  test('tenant user gets their organizationId filter applied', () => {
    // Simulate: fleet_manager logged in; attachTenant resolved their org
    // and set req.tenantId.
    const req = {
      user: { role: 'fleet_manager', organizationId: '665f1f77bcf86cd799439099' },
      tenantId: '665f1f77bcf86cd799439099',
    };
    expect(tenantFilter(req)).toEqual({
      organizationId: '665f1f77bcf86cd799439099',
    });
  });

  test('the returned filter object is a fresh object each call (no shared refs)', () => {
    const req = { tenantId: 'org-1' };
    const a = tenantFilter(req);
    const b = tenantFilter(req);
    expect(a).not.toBe(b); // different object references
    expect(a).toEqual(b); // but same contents
  });
});
