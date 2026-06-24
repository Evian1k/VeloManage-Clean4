import Organization from '../models/Organization.js';
import { PLATFORM_ROLES, ROLES } from '../config/rbac.js';

/**
 * Tenant isolation middleware.
 *
 * Resolves the caller's organization from:
 *   1. req.user.organizationId (set during auth)
 *   2. header 'x-organization-id' (for platform-level admins switching tenants)
 *
 * Then attaches it to req.tenant and provides req.tenantFilter() that returns
 * a mongoose query filter object every route handler should spread into its
 * find() / update() / delete() calls.
 *
 * Platform roles (super_admin, platform_owner) bypass the filter — they can
 * read across all tenants.
 */
export async function attachTenant(req, res, next) {
  if (!req.user) return next();

  // Platform admins can pass x-organization-id to act in a tenant context
  const headerOrgId = req.header('x-organization-id');
  const userOrgId = req.user.organizationId?.toString();

  let orgId = userOrgId;
  if (headerOrgId && PLATFORM_ROLES.includes(req.user.role)) {
    orgId = headerOrgId;
  }

  if (orgId) {
    try {
      const org = await Organization.findById(orgId).lean();
      if (org && org.isActive) {
        req.tenant = org;
        req.tenantId = org._id;
      } else if (org && !org.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Organization is suspended or inactive.',
        });
      }
    } catch (e) {
      // Invalid ObjectId — continue without tenant
    }
  }

  next();
}

/**
 * Returns a mongoose filter object that scope a query to the current tenant.
 * Platform admins without an explicit tenant context get an empty filter (all tenants).
 *
 * Usage:
 *   const filter = { ...req.tenantFilter(), status: 'active' };
 *   const vehicles = await Vehicle.find(filter);
 */
export function tenantFilter(req) {
  if (!req.tenantId) {
    // Platform admin without tenant context — no filter
    return {};
  }
  return { organizationId: req.tenantId };
}

/**
 * Rejects the request if the caller has no tenant context AND is not a platform admin.
 * Use on routes where a tenant context is mandatory (e.g. creating a vehicle).
 */
export function requireTenant(req, res, next) {
  if (!req.tenantId && !PLATFORM_ROLES.includes(req.user?.role)) {
    return res.status(400).json({
      success: false,
      message: 'Tenant context required. Ensure you are assigned to an organization.',
    });
  }
  next();
}

/**
 * Validates that a referenced resource (by id) belongs to the caller's tenant.
 *
 * Usage:
 *   router.put('/vehicles/:id', validateTenantOwnership('Vehicle', 'params', 'id'), ...)
 *
 * @param {string} modelName - Mongoose model name
 * @param {string} source - 'params' | 'body' | 'query'
 * @param {string} key - the field name containing the id
 */
export function validateTenantOwnership(modelName, source = 'params', key = 'id') {
  return async (req, res, next) => {
    try {
      const id = req[source]?.[key];
      if (!id) return next();

      // Platform admins skip ownership check
      if (PLATFORM_ROLES.includes(req.user?.role)) return next();

      const Model = mongoose.model(modelName);
      const doc = await Model.findById(id).lean();
      if (!doc) {
        return res.status(404).json({ success: false, message: `${modelName} not found.` });
      }

      if (doc.organizationId?.toString() !== req.tenantId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Cross-tenant access denied.',
        });
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

import mongoose from 'mongoose';

export default { attachTenant, tenantFilter, requireTenant, validateTenantOwnership };
