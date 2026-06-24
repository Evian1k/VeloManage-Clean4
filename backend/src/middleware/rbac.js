import { roleHasPermission, ROLE_LABELS, PLATFORM_ROLES } from '../config/rbac.js';

/**
 * Role-Based Access Control middleware.
 *
 * Three usage patterns:
 *
 *   1. requireRole('fleet_manager')
 *      — single role check
 *
 *   2. requireRole(['fleet_manager', 'operations_manager'])
 *      — any of the listed roles
 *
 *   3. requirePermission('vehicles:write')
 *      — checks the role→permission matrix
 *
 *   4. requireAnyPermission(['vehicles:write', 'vehicles:delete'])
 *      — any of the listed permissions
 *
 * Must run AFTER authenticateToken middleware (requires req.user).
 * Platform roles (super_admin, platform_owner) bypass all checks.
 */

export function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (PLATFORM_ROLES.includes(req.user.role)) return next();
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowed.map(r => ROLE_LABELS[r] || r).join(' or ')}.`,
      });
    }
    next();
  };
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (PLATFORM_ROLES.includes(req.user.role)) return next();
    if (!roleHasPermission(req.user.role, permission)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${permission}`,
        your_role: req.user.role,
      });
    }
    next();
  };
}

export function requireAnyPermission(permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (PLATFORM_ROLES.includes(req.user.role)) return next();
    const hasAny = permissions.some((p) => roleHasPermission(req.user.role, p));
    if (!hasAny) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of: ${permissions.join(', ')}`,
      });
    }
    next();
  };
}

/**
 * Require ALL listed permissions (AND semantics).
 */
export function requireAllPermissions(permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (PLATFORM_ROLES.includes(req.user.role)) return next();
    const missing = permissions.filter((p) => !roleHasPermission(req.user.role, p));
    if (missing.length > 0) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Missing permissions: ${missing.join(', ')}`,
      });
    }
    next();
  };
}

export default { requireRole, requirePermission, requireAnyPermission, requireAllPermissions };
