import express from 'express';
import Organization from '../models/Organization.js';
import Branch from '../models/Branch.js';
import { requirePermission, requireRole } from '../middleware/rbac.js';
import { ROLES, PLATFORM_ROLES } from '../config/rbac.js';
import { tenantFilter } from '../middleware/tenant.js';
import { recordAudit } from '../models/AuditLog.js';

const router = express.Router();

// List organizations (platform admins only see all; tenant users see their own)
router.get('/', requirePermission('organization:read'), async (req, res, next) => {
  try {
    const filter = {};
    if (!PLATFORM_ROLES.includes(req.user.role)) {
      filter._id = req.user.organizationId;
    }
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.plan) filter.plan = req.query.plan;
    const orgs = await Organization.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: orgs });
  } catch (err) { next(err); }
});

// Get my organization
router.get('/me', async (req, res, next) => {
  try {
    if (!req.user?.organizationId) {
      return res.status(400).json({ success: false, message: 'No organization associated' });
    }
    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });
    res.json({ success: true, data: org });
  } catch (err) { next(err); }
});

// Get by id
router.get('/:id', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ success: false, message: 'Not found' });
    // Tenant isolation
    if (!PLATFORM_ROLES.includes(req.user.role) && req.user.organizationId?.toString() !== org._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    res.json({ success: true, data: org });
  } catch (err) { next(err); }
});

// Create organization (platform admin only)
router.post('/', requireRole([ROLES.SUPER_ADMIN, ROLES.PLATFORM_OWNER]), async (req, res, next) => {
  try {
    const org = new Organization(req.body);
    await org.save();
    await recordAudit({
      userId: req.user._id, userRole: req.user.role, userEmail: req.user.email,
      organizationId: org._id, ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      action: 'organization.create', category: 'organization', severity: 'warning',
      status: 'success', statusCode: 201, method: 'POST', path: req.originalUrl,
      resourceType: 'Organization', resourceId: org._id.toString(),
      resourceName: org.name, after: org.toSafeObject(),
    });
    res.status(201).json({ success: true, data: org, message: 'Organization created' });
  } catch (err) { next(err); }
});

// Update organization
router.put('/:id', requirePermission('organization:write'), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ success: false, message: 'Not found' });
    if (!PLATFORM_ROLES.includes(req.user.role) && req.user.organizationId?.toString() !== org._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const before = org.toSafeObject();
    Object.assign(org, req.body);
    await org.save();
    await recordAudit({
      userId: req.user._id, userRole: req.user.role, userEmail: req.user.email,
      organizationId: org._id, ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      action: 'organization.update', category: 'organization', severity: 'warning',
      status: 'success', statusCode: 200, method: 'PUT', path: req.originalUrl,
      resourceType: 'Organization', resourceId: org._id.toString(),
      resourceName: org.name, before, after: org.toSafeObject(),
    });
    res.json({ success: true, data: org, message: 'Organization updated' });
  } catch (err) { next(err); }
});

// Suspend / reactivate
router.post('/:id/suspend', requireRole([ROLES.SUPER_ADMIN, ROLES.PLATFORM_OWNER]), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ success: false, message: 'Not found' });
    org.isActive = false;
    org.suspendedAt = new Date();
    org.suspensionReason = req.body.reason;
    await org.save();
    res.json({ success: true, data: org, message: 'Organization suspended' });
  } catch (err) { next(err); }
});

router.post('/:id/reactivate', requireRole([ROLES.SUPER_ADMIN, ROLES.PLATFORM_OWNER]), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ success: false, message: 'Not found' });
    org.isActive = true;
    org.suspendedAt = undefined;
    org.suspensionReason = undefined;
    await org.save();
    res.json({ success: true, data: org, message: 'Organization reactivated' });
  } catch (err) { next(err); }
});

// ─── Branches (tenant-scoped) ──────────────────────────────────────────────
router.get('/:orgId/branches', async (req, res, next) => {
  try {
    const filter = { organizationId: req.params.orgId };
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    const branches = await Branch.find(filter).sort({ name: 1 });
    res.json({ success: true, data: branches });
  } catch (err) { next(err); }
});

router.post('/:orgId/branches', requirePermission('organization:write'), async (req, res, next) => {
  try {
    const branch = new Branch({ ...req.body, organizationId: req.params.orgId });
    await branch.save();
    res.status(201).json({ success: true, data: branch });
  } catch (err) { next(err); }
});

export default router;
