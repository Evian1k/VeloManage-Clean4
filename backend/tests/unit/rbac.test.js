/**
 * Unit tests for the RBAC configuration: roles, permissions, labels.
 *
 * Covers src/config/rbac.js
 */
import { describe, test, expect } from '@jest/globals';

import {
  ROLES,
  ALL_ROLES,
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  ROLE_LEVELS,
  PLATFORM_ROLES,
  TENANT_ADMIN_ROLES,
  roleHasPermission,
  getAllPermissionsForRole,
} from '../../src/config/rbac.js';

describe('RBAC — roleHasPermission', () => {
  test('super_admin returns true for ANY permission (wildcard "*")', () => {
    expect(roleHasPermission(ROLES.SUPER_ADMIN, 'vehicles:read')).toBe(true);
    expect(roleHasPermission(ROLES.SUPER_ADMIN, 'vehicles:write')).toBe(true);
    expect(roleHasPermission(ROLES.SUPER_ADMIN, 'vehicles:delete')).toBe(true);
    expect(roleHasPermission(ROLES.SUPER_ADMIN, 'billing:manage')).toBe(true);
    expect(roleHasPermission(ROLES.SUPER_ADMIN, 'some:never:defined:perm')).toBe(true);
  });

  test('platform_owner also has the "*" wildcard', () => {
    expect(roleHasPermission(ROLES.PLATFORM_OWNER, 'anything:any:time')).toBe(true);
  });

  test('driver has gps:write but NOT vehicles:delete', () => {
    expect(roleHasPermission(ROLES.DRIVER, 'gps:write')).toBe(true);
    expect(roleHasPermission(ROLES.DRIVER, 'gps:read')).toBe(true);
    expect(roleHasPermission(ROLES.DRIVER, 'vehicles:read')).toBe(true);
    expect(roleHasPermission(ROLES.DRIVER, 'vehicles:write')).toBe(false);
    expect(roleHasPermission(ROLES.DRIVER, 'vehicles:delete')).toBe(false);
  });

  test('driver has fuel:write and accidents:write (mobile field reporting)', () => {
    expect(roleHasPermission(ROLES.DRIVER, 'fuel:write')).toBe(true);
    expect(roleHasPermission(ROLES.DRIVER, 'accidents:write')).toBe(true);
    expect(roleHasPermission(ROLES.DRIVER, 'trips:read')).toBe(true);
    expect(roleHasPermission(ROLES.DRIVER, 'trips:write')).toBe(false);
  });

  test('mechanic has maintenance:write but NOT maintenance:approve', () => {
    expect(roleHasPermission(ROLES.MECHANIC, 'maintenance:read')).toBe(true);
    expect(roleHasPermission(ROLES.MECHANIC, 'maintenance:write')).toBe(true);
    expect(roleHasPermission(ROLES.MECHANIC, 'maintenance:approve')).toBe(false);
    expect(roleHasPermission(ROLES.MECHANIC, 'maintenance:delete')).toBe(false);
    expect(roleHasPermission(ROLES.MECHANIC, 'parts:read')).toBe(true);
    expect(roleHasPermission(ROLES.MECHANIC, 'parts:write')).toBe(true);
  });

  test('read_only_user has ONLY read permissions', () => {
    expect(roleHasPermission(ROLES.READ_ONLY_USER, 'vehicles:read')).toBe(true);
    expect(roleHasPermission(ROLES.READ_ONLY_USER, 'drivers:read')).toBe(true);
    expect(roleHasPermission(ROLES.READ_ONLY_USER, 'gps:read')).toBe(true);
    expect(roleHasPermission(ROLES.READ_ONLY_USER, 'trips:read')).toBe(true);
    expect(roleHasPermission(ROLES.READ_ONLY_USER, 'analytics:read')).toBe(true);
    expect(roleHasPermission(ROLES.READ_ONLY_USER, 'reports:read')).toBe(true);

    // No write/delete anywhere
    expect(roleHasPermission(ROLES.READ_ONLY_USER, 'vehicles:write')).toBe(false);
    expect(roleHasPermission(ROLES.READ_ONLY_USER, 'vehicles:delete')).toBe(false);
    expect(roleHasPermission(ROLES.READ_ONLY_USER, 'maintenance:write')).toBe(false);
    expect(roleHasPermission(ROLES.READ_ONLY_USER, 'fuel:write')).toBe(false);
  });

  test('unknown role returns false for any permission', () => {
    expect(roleHasPermission('guest', 'vehicles:read')).toBe(false);
    expect(roleHasPermission('guest', 'anything:whatever')).toBe(false);
    expect(roleHasPermission(undefined, 'vehicles:read')).toBe(false);
    expect(roleHasPermission(null, 'vehicles:read')).toBe(false);
    expect(roleHasPermission('', 'vehicles:read')).toBe(false);
  });

  test('fleet_manager has the standard fleet-management permission set', () => {
    expect(roleHasPermission(ROLES.FLEET_MANAGER, 'vehicles:read')).toBe(true);
    expect(roleHasPermission(ROLES.FLEET_MANAGER, 'vehicles:write')).toBe(true);
    expect(roleHasPermission(ROLES.FLEET_MANAGER, 'maintenance:approve')).toBe(true);
    expect(roleHasPermission(ROLES.FLEET_MANAGER, 'vehicles:delete')).toBe(false);
  });

  test('finance_officer can approve and delete finance entries', () => {
    expect(roleHasPermission(ROLES.FINANCE_OFFICER, 'finance:read')).toBe(true);
    expect(roleHasPermission(ROLES.FINANCE_OFFICER, 'finance:write')).toBe(true);
    expect(roleHasPermission(ROLES.FINANCE_OFFICER, 'finance:approve')).toBe(true);
    expect(roleHasPermission(ROLES.FINANCE_OFFICER, 'finance:delete')).toBe(true);
  });

  test('auditor can read audit logs but cannot write', () => {
    expect(roleHasPermission(ROLES.AUDITOR, 'audit:read')).toBe(true);
    expect(roleHasPermission(ROLES.AUDITOR, 'finance:read')).toBe(true);
    expect(roleHasPermission(ROLES.AUDITOR, 'reports:export')).toBe(true);
    expect(roleHasPermission(ROLES.AUDITOR, 'vehicles:write')).toBe(false);
  });
});

describe('RBAC — module wildcard', () => {
  // None of the predefined roles currently use the `module:*` wildcard form,
  // but the matcher explicitly supports it. Verify via a synthetic test:
  test('a permission ending in ":*" grants any action in that module', () => {
    const original = ROLE_PERMISSIONS[ROLES.DRIVER];
    ROLE_PERMISSIONS[ROLES.DRIVER] = [...original, 'vehicles:*'];
    try {
      expect(roleHasPermission(ROLES.DRIVER, 'vehicles:read')).toBe(true);
      expect(roleHasPermission(ROLES.DRIVER, 'vehicles:write')).toBe(true);
      expect(roleHasPermission(ROLES.DRIVER, 'vehicles:delete')).toBe(true);
      expect(roleHasPermission(ROLES.DRIVER, 'vehicles:fly')).toBe(true);
      // Should NOT grant a different module
      expect(roleHasPermission(ROLES.DRIVER, 'drivers:delete')).toBe(false);
    } finally {
      ROLE_PERMISSIONS[ROLES.DRIVER] = original;
    }
  });
});

describe('RBAC — getAllPermissionsForRole', () => {
  test('super_admin returns the FULL union of all roles\' permissions', () => {
    const all = getAllPermissionsForRole(ROLES.SUPER_ADMIN);
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(20); // we have many permissions defined

    // Must include representative permissions from several modules
    expect(all).toContain('vehicles:read');
    expect(all).toContain('vehicles:write');
    expect(all).toContain('vehicles:delete');
    expect(all).toContain('maintenance:write');
    expect(all).toContain('maintenance:approve');
    expect(all).toContain('finance:approve');
    expect(all).toContain('gps:write');
    expect(all).toContain('audit:read');

    // The '*' sentinel must NOT appear in the expanded list
    expect(all).not.toContain('*');

    // No duplicates
    expect(new Set(all).size).toBe(all.length);
  });

  test('platform_owner also expands to the full set', () => {
    const all = getAllPermissionsForRole(ROLES.PLATFORM_OWNER);
    expect(all).toEqual(getAllPermissionsForRole(ROLES.SUPER_ADMIN));
  });

  test('a non-wildcard role returns its own permission list', () => {
    const driverPerms = getAllPermissionsForRole(ROLES.DRIVER);
    expect(driverPerms).toEqual(ROLE_PERMISSIONS[ROLES.DRIVER]);
    expect(driverPerms).toContain('gps:write');
    expect(driverPerms).not.toContain('vehicles:delete');
  });

  test('unknown role returns an empty array', () => {
    expect(getAllPermissionsForRole('nonexistent_role')).toEqual([]);
    expect(getAllPermissionsForRole(undefined)).toEqual([]);
    expect(getAllPermissionsForRole(null)).toEqual([]);
  });
});

describe('RBAC — ROLE_LABELS', () => {
  test('includes all 16 roles with human-readable labels', () => {
    expect(Object.keys(ROLE_LABELS)).toHaveLength(16);

    // Every role in ROLES has a label
    for (const roleKey of Object.keys(ROLES)) {
      const roleValue = ROLES[roleKey];
      expect(ROLE_LABELS[roleValue]).toBeDefined();
      expect(typeof ROLE_LABELS[roleValue]).toBe('string');
      expect(ROLE_LABELS[roleValue].length).toBeGreaterThan(0);
    }

    // Spot-check a few labels
    expect(ROLE_LABELS[ROLES.SUPER_ADMIN]).toBe('Super Admin');
    expect(ROLE_LABELS[ROLES.DRIVER]).toBe('Driver');
    expect(ROLE_LABELS[ROLES.MECHANIC]).toBe('Mechanic');
    expect(ROLE_LABELS[ROLES.READ_ONLY_USER]).toBe('Read-Only User');
    expect(ROLE_LABELS[ROLES.FINANCE_OFFICER]).toBe('Finance Officer');
    expect(ROLE_LABELS[ROLES.COMPLIANCE_OFFICER]).toBe('Compliance Officer');
  });

  test('ALL_ROLES lists all 16 role values', () => {
    expect(ALL_ROLES).toHaveLength(16);
    expect(ALL_ROLES).toContain(ROLES.SUPER_ADMIN);
    expect(ALL_ROLES).toContain(ROLES.READ_ONLY_USER);
    expect(ALL_ROLES).toContain(ROLES.MECHANIC);
  });
});

describe('RBAC — PLATFORM_ROLES & TENANT_ADMIN_ROLES', () => {
  test('PLATFORM_ROLES contains super_admin and platform_owner', () => {
    expect(PLATFORM_ROLES).toHaveLength(2);
    expect(PLATFORM_ROLES).toContain(ROLES.SUPER_ADMIN);
    expect(PLATFORM_ROLES).toContain(ROLES.PLATFORM_OWNER);
  });

  test('TENANT_ADMIN_ROLES contains company_owner and friends', () => {
    expect(TENANT_ADMIN_ROLES).toContain(ROLES.COMPANY_OWNER);
    expect(TENANT_ADMIN_ROLES).toContain(ROLES.REGIONAL_MANAGER);
    expect(TENANT_ADMIN_ROLES).toContain(ROLES.FLEET_MANAGER);
    expect(TENANT_ADMIN_ROLES).toContain(ROLES.OPERATIONS_MANAGER);
    expect(TENANT_ADMIN_ROLES).toContain(ROLES.BRANCH_MANAGER);
  });
});

describe('RBAC — ROLE_LEVELS hierarchy', () => {
  test('super_admin has the lowest (most privileged) level', () => {
    expect(ROLE_LEVELS[ROLES.SUPER_ADMIN]).toBe(0);
  });

  test('read_only_user has the highest (least privileged) level', () => {
    expect(ROLE_LEVELS[ROLES.READ_ONLY_USER]).toBe(99);
  });

  test('every role in ROLES has a level', () => {
    for (const roleValue of Object.values(ROLES)) {
      expect(ROLE_LEVELS[roleValue]).toBeDefined();
      expect(typeof ROLE_LEVELS[roleValue]).toBe('number');
    }
  });
});
