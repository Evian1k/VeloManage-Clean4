import mongoose from 'mongoose';

/**
 * Generic CRUD factory — produces standard REST endpoints for a Mongoose model
 * with multi-tenant isolation, RBAC, audit logging, pagination, filtering.
 *
 * Each route handler applies:
 *   - tenantFilter(req) for row-level isolation
 *   - audit logging of create/update/delete
 *
 * Usage:
 *   import { createCrudRouter } from './crudFactory.js';
 *   import Vehicle from '../models/Vehicle.js';
 *   const router = createCrudRouter(Vehicle, {
 *     permissions: { read: 'vehicles:read', write: 'vehicles:write', delete: 'vehicles:delete' },
 *     category: 'vehicle',
 *     searchableFields: ['vehicleId', 'licensePlate', 'make', 'model'],
 *     defaultSort: { createdAt: -1 },
 *     population: [{ path: 'assignedDriverId', select: 'fullName email' }],
 *   });
 *
 * Returns an express Router that handles:
 *   GET    /            — list with pagination/filter/sort/search
 *   GET    /:id         — get one
 *   POST   /            — create
 *   PUT    /:id         — update
 *   DELETE /:id         — delete
 *
 * Middleware expectations: authenticateToken, attachTenant must run BEFORE this router.
 */

import { requirePermission } from '../middleware/rbac.js';
import { recordAudit } from '../models/AuditLog.js';

export function createCrudRouter(Model, options = {}) {
  const router = express.Router();
  const {
    permissions = {},
    category = 'other',
    searchableFields = [],
    defaultSort = { createdAt: -1 },
    population = [],
    defaultLimit = 50,
    maxLimit = 200,
  } = options;

  const modelName = Model.modelName;

  // Apply RBAC: read for GET, write for POST/PUT, delete for DELETE
  if (permissions.read) router.use(requirePermission(permissions.read));

  // ─── LIST ─────────────────────────────────────────────────────────────────
  router.get('/', async (req, res, next) => {
    try {
      // Build filter
      const filter = { ...tenantFilter(req) };

      // Search
      if (req.query.search && searchableFields.length > 0) {
        filter.$or = searchableFields.map(field => ({
          [field]: { $regex: req.query.search, $options: 'i' },
        }));
      }

      // Field-specific filters (e.g. ?status=active&type=truck)
      const reserved = ['page', 'limit', 'sort', 'search', 'fields', 'populate'];
      for (const key of Object.keys(req.query)) {
        if (reserved.includes(key)) continue;
        const value = req.query[key];
        if (value === 'true') filter[key] = true;
        else if (value === 'false') filter[key] = false;
        else if (/^[0-9a-fA-F]{24}$/.test(value)) filter[key] = value;
        else if (typeof value === 'string' && value.includes(',')) {
          filter[key] = { $in: value.split(',') };
        } else {
          filter[key] = value;
        }
      }

      // Pagination
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit) || defaultLimit));
      const skip = (page - 1) * limit;

      // Sort
      let sort = defaultSort;
      if (req.query.sort) {
        const sortStr = req.query.sort;
        if (sortStr.startsWith('-')) sort = { [sortStr.slice(1)]: -1 };
        else sort = { [sortStr]: 1 };
      }

      // Build query
      let query = Model.find(filter).sort(sort).skip(skip).limit(limit);
      // Population
      const populateFields = req.query.populate ? req.query.populate.split(',') : population.map(p => p.path);
      for (const path of populateFields) {
        const popConfig = population.find(p => p.path === path) || { path };
        query = query.populate(popConfig);
      }

      // Field selection
      if (req.query.fields) {
        query = query.select(req.query.fields.split(',').join(' '));
      }

      const [items, total] = await Promise.all([
        query.exec(),
        Model.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: items,
        pagination: {
          page, limit, total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      });
    } catch (err) { next(err); }
  });

  // ─── GET ONE ──────────────────────────────────────────────────────────────
  router.get('/:id', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid ID' });
      }
      let query = Model.findOne({ _id: req.params.id, ...tenantFilter(req) });
      for (const p of population) query = query.populate(p);
      const item = await query.exec();
      if (!item) {
        return res.status(404).json({ success: false, message: `${modelName} not found` });
      }
      res.json({ success: true, data: item });
    } catch (err) { next(err); }
  });

  // ─── CREATE ───────────────────────────────────────────────────────────────
  router.post('/', permissions.write ? requirePermission(permissions.write) : (req, res, next) => next(), async (req, res, next) => {
    try {
      const data = { ...req.body, organizationId: req.tenantId };
      const item = new Model(data);
      // Track creator
      if (req.user) item.createdBy = req.user._id;
      await item.save();
      // Audit
      if (req.user) {
        await recordAudit({
          userId: req.user._id, userRole: req.user.role, userEmail: req.user.email,
          organizationId: req.tenantId, ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
          action: `${category}.create`, category,
          status: 'success', statusCode: 201, method: 'POST', path: req.originalUrl,
          resourceType: modelName, resourceId: item._id.toString(),
          resourceName: item.name || item.title || item.vehicleId || item._id.toString(),
          after: item.toJSON ? item.toJSON() : item.toObject(),
        });
      }
      res.status(201).json({ success: true, data: item, message: `${modelName} created` });
    } catch (err) { next(err); }
  });

  // ─── UPDATE ───────────────────────────────────────────────────────────────
  router.put('/:id', permissions.write ? requirePermission(permissions.write) : (req, res, next) => next(), async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid ID' });
      }
      const before = await Model.findOne({ _id: req.params.id, ...tenantFilter(req) }).lean();
      if (!before) {
        return res.status(404).json({ success: false, message: `${modelName} not found` });
      }
      // Never allow organizationId to be changed via update
      delete req.body.organizationId;
      const item = await Model.findOneAndUpdate(
        { _id: req.params.id, ...tenantFilter(req) },
        { ...req.body, updatedBy: req.user?._id },
        { new: true, runValidators: true },
      );
      if (req.user) {
        await recordAudit({
          userId: req.user._id, userRole: req.user.role, userEmail: req.user.email,
          organizationId: req.tenantId, ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
          action: `${category}.update`, category,
          status: 'success', statusCode: 200, method: 'PUT', path: req.originalUrl,
          resourceType: modelName, resourceId: item._id.toString(),
          resourceName: item.name || item.title || item.vehicleId || item._id.toString(),
          before, after: item.toJSON ? item.toJSON() : item.toObject(),
        });
      }
      res.json({ success: true, data: item, message: `${modelName} updated` });
    } catch (err) { next(err); }
  });

  // ─── DELETE (soft) ────────────────────────────────────────────────────────
  router.delete('/:id', permissions.delete ? requirePermission(permissions.delete) : (req, res, next) => next(), async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid ID' });
      }
      const before = await Model.findOne({ _id: req.params.id, ...tenantFilter(req) }).lean();
      if (!before) {
        return res.status(404).json({ success: false, message: `${modelName} not found` });
      }
      // Soft delete if model has isActive, hard delete otherwise
      if (before.isActive !== undefined) {
        await Model.updateOne(
          { _id: req.params.id, ...tenantFilter(req) },
          { isActive: false, updatedBy: req.user?._id },
        );
      } else {
        await Model.deleteOne({ _id: req.params.id, ...tenantFilter(req) });
      }
      if (req.user) {
        await recordAudit({
          userId: req.user._id, userRole: req.user.role, userEmail: req.user.email,
          organizationId: req.tenantId, ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
          action: `${category}.delete`, category, severity: 'warning',
          status: 'success', statusCode: 200, method: 'DELETE', path: req.originalUrl,
          resourceType: modelName, resourceId: req.params.id,
          before,
        });
      }
      res.json({ success: true, message: `${modelName} deleted` });
    } catch (err) { next(err); }
  });

  return router;
}

// Re-export helpers (avoid circular import)
import express from 'express';
import { tenantFilter } from '../middleware/tenant.js';

function getClientIp(req) {
  return (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) ||
         req.headers['x-real-ip'] ||
         req.socket?.remoteAddress ||
         '0.0.0.0';
}

export default createCrudRouter;
