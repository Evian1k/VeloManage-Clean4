/**
 * VeloManage RBAC — Role & Permission definitions
 *
 * 16 roles as specified in the enterprise requirements.
 * Permission matrix is the single source of truth — `requirePermission('...')`
 * middleware checks this map.
 *
 * Permission naming convention:
 *   <module>:<action>[:<scope>]
 * e.g.
 *   vehicles:read, vehicles:write, vehicles:delete
 *   fleet:read:all     (cross-tenant)
 *   billing:manage
 */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  PLATFORM_OWNER: 'platform_owner',
  COMPANY_OWNER: 'company_owner',
  REGIONAL_MANAGER: 'regional_manager',
  FLEET_MANAGER: 'fleet_manager',
  OPERATIONS_MANAGER: 'operations_manager',
  BRANCH_MANAGER: 'branch_manager',
  DRIVER: 'driver',
  MECHANIC: 'mechanic',
  DISPATCHER: 'dispatcher',
  FINANCE_OFFICER: 'finance_officer',
  HR_OFFICER: 'hr_officer',
  AUDITOR: 'auditor',
  COMPLIANCE_OFFICER: 'compliance_officer',
  CUSTOMER_SUPPORT: 'customer_support',
  READ_ONLY_USER: 'read_only_user',
};

export const ALL_ROLES = Object.values(ROLES);

export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: ['*'],
  [ROLES.PLATFORM_OWNER]: ['*'],

  [ROLES.COMPANY_OWNER]: [
    'organization:read', 'organization:write', 'organization:billing',
    'users:read', 'users:write', 'users:delete', 'users:invite',
    'vehicles:read', 'vehicles:write', 'vehicles:delete',
    'drivers:read', 'drivers:write', 'drivers:delete',
    'maintenance:read', 'maintenance:write', 'maintenance:approve', 'maintenance:delete',
    'fuel:read', 'fuel:write', 'fuel:delete',
    'gps:read', 'gps:write',
    'trips:read', 'trips:write', 'trips:delete',
    'compliance:read', 'compliance:write', 'compliance:delete',
    'accidents:read', 'accidents:write', 'accidents:delete',
    'finance:read', 'finance:write', 'finance:delete', 'finance:approve',
    'hr:read', 'hr:write', 'hr:delete',
    'procurement:read', 'procurement:write', 'procurement:approve', 'procurement:delete',
    'assets:read', 'assets:write', 'assets:delete',
    'crm:read', 'crm:write', 'crm:delete',
    'vendors:read', 'vendors:write', 'vendors:delete',
    'analytics:read', 'reports:read', 'reports:export',
    'audit:read', 'settings:read', 'settings:write',
  ],

  [ROLES.REGIONAL_MANAGER]: [
    'organization:read',
    'users:read', 'users:invite',
    'vehicles:read', 'vehicles:write',
    'drivers:read', 'drivers:write',
    'maintenance:read', 'maintenance:write',
    'fuel:read',
    'gps:read',
    'trips:read', 'trips:write',
    'compliance:read',
    'accidents:read', 'accidents:write',
    'finance:read',
    'hr:read',
    'analytics:read', 'reports:read',
  ],

  [ROLES.FLEET_MANAGER]: [
    'vehicles:read', 'vehicles:write',
    'drivers:read', 'drivers:write',
    'maintenance:read', 'maintenance:write', 'maintenance:approve',
    'fuel:read', 'fuel:write',
    'gps:read',
    'trips:read', 'trips:write',
    'compliance:read',
    'accidents:read', 'accidents:write',
    'analytics:read', 'reports:read',
  ],

  [ROLES.OPERATIONS_MANAGER]: [
    'vehicles:read',
    'drivers:read', 'drivers:write',
    'gps:read',
    'trips:read', 'trips:write', 'trips:delete',
    'maintenance:read',
    'analytics:read',
  ],

  [ROLES.BRANCH_MANAGER]: [
    'vehicles:read',
    'drivers:read', 'drivers:write',
    'maintenance:read', 'maintenance:write',
    'gps:read',
    'trips:read', 'trips:write',
    'finance:read',
    'hr:read',
    'analytics:read',
  ],

  [ROLES.DISPATCHER]: [
    'vehicles:read',
    'drivers:read',
    'gps:read',
    'trips:read', 'trips:write',
    'maintenance:read',
  ],

  [ROLES.DRIVER]: [
    'vehicles:read',
    'gps:read', 'gps:write',
    'trips:read',
    'fuel:write',
    'accidents:write',
  ],

  [ROLES.MECHANIC]: [
    'vehicles:read',
    'maintenance:read', 'maintenance:write',
    'parts:read', 'parts:write',
  ],

  [ROLES.FINANCE_OFFICER]: [
    'finance:read', 'finance:write', 'finance:approve', 'finance:delete',
    'fuel:read',
    'procurement:read', 'procurement:approve',
    'analytics:read', 'reports:read', 'reports:export',
  ],

  [ROLES.HR_OFFICER]: [
    'hr:read', 'hr:write', 'hr:delete',
    'users:read', 'users:invite',
    'analytics:read',
  ],

  [ROLES.AUDITOR]: [
    'audit:read',
    'finance:read',
    'compliance:read',
    'reports:read', 'reports:export',
    'analytics:read',
  ],

  [ROLES.COMPLIANCE_OFFICER]: [
    'compliance:read', 'compliance:write', 'compliance:delete',
    'accidents:read', 'accidents:write',
    'vehicles:read',
    'drivers:read',
    'reports:read', 'reports:export',
  ],

  [ROLES.CUSTOMER_SUPPORT]: [
    'users:read',
    'crm:read', 'crm:write',
    'trips:read',
    'vehicles:read',
  ],

  [ROLES.READ_ONLY_USER]: [
    'vehicles:read',
    'drivers:read',
    'gps:read',
    'trips:read',
    'analytics:read',
    'reports:read',
  ],
};

export function roleHasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  if (perms.includes('*')) return true;
  if (perms.includes(permission)) return true;
  const moduleWildcard = `${permission.split(':')[0]}:*`;
  if (perms.includes(moduleWildcard)) return true;
  return false;
}

export function getAllPermissionsForRole(role) {
  const perms = ROLE_PERMISSIONS[role] || [];
  if (perms.includes('*')) {
    const all = new Set();
    Object.values(ROLE_PERMISSIONS).forEach((arr) => {
      arr.forEach((p) => { if (p !== '*') all.add(p); });
    });
    return Array.from(all);
  }
  return perms;
}

export const ROLE_LEVELS = {
  [ROLES.SUPER_ADMIN]: 0,
  [ROLES.PLATFORM_OWNER]: 1,
  [ROLES.COMPANY_OWNER]: 10,
  [ROLES.REGIONAL_MANAGER]: 20,
  [ROLES.FLEET_MANAGER]: 30,
  [ROLES.OPERATIONS_MANAGER]: 30,
  [ROLES.BRANCH_MANAGER]: 35,
  [ROLES.FINANCE_OFFICER]: 40,
  [ROLES.HR_OFFICER]: 40,
  [ROLES.COMPLIANCE_OFFICER]: 40,
  [ROLES.AUDITOR]: 45,
  [ROLES.DISPATCHER]: 50,
  [ROLES.CUSTOMER_SUPPORT]: 55,
  [ROLES.MECHANIC]: 60,
  [ROLES.DRIVER]: 70,
  [ROLES.READ_ONLY_USER]: 99,
};

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.PLATFORM_OWNER]: 'Platform Owner',
  [ROLES.COMPANY_OWNER]: 'Company Owner',
  [ROLES.REGIONAL_MANAGER]: 'Regional Manager',
  [ROLES.FLEET_MANAGER]: 'Fleet Manager',
  [ROLES.OPERATIONS_MANAGER]: 'Operations Manager',
  [ROLES.BRANCH_MANAGER]: 'Branch Manager',
  [ROLES.DRIVER]: 'Driver',
  [ROLES.MECHANIC]: 'Mechanic',
  [ROLES.DISPATCHER]: 'Dispatcher',
  [ROLES.FINANCE_OFFICER]: 'Finance Officer',
  [ROLES.HR_OFFICER]: 'HR Officer',
  [ROLES.AUDITOR]: 'Auditor',
  [ROLES.COMPLIANCE_OFFICER]: 'Compliance Officer',
  [ROLES.CUSTOMER_SUPPORT]: 'Customer Support',
  [ROLES.READ_ONLY_USER]: 'Read-Only User',
};

export const TENANT_ADMIN_ROLES = [
  ROLES.COMPANY_OWNER,
  ROLES.REGIONAL_MANAGER,
  ROLES.FLEET_MANAGER,
  ROLES.OPERATIONS_MANAGER,
  ROLES.BRANCH_MANAGER,
];

export const PLATFORM_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.PLATFORM_OWNER,
];

export default {
  ROLES,
  ALL_ROLES,
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  ROLE_LEVELS,
  TENANT_ADMIN_ROLES,
  PLATFORM_ROLES,
  roleHasPermission,
  getAllPermissionsForRole,
};
