import express from 'express';
import AuditLog, { recordAudit } from '../models/AuditLog.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantFilter } from '../middleware/tenant.js';
import { PLATFORM_ROLES } from '../config/rbac.js';

const router = express.Router();

// All routes here require audit:read permission
router.use(requirePermission('audit:read'));

// List audit logs with filtering
router.get('/', async (req, res, next) => {
  try {
    const filter = tenantFilter(req);
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.severity) filter.severity = req.query.severity;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.resourceType) filter.resourceType = req.query.resourceType;
    if (req.query.resourceId) filter.resourceId = req.query.resourceId;
    if (req.query.startDate || req.query.endDate) {
      filter.timestamp = {};
      if (req.query.startDate) filter.timestamp.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.timestamp.$lte = new Date(req.query.endDate);
    }
    if (req.query.ipAddress) filter.ipAddress = req.query.ipAddress;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit)
        .populate('userId', 'name email role'),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
});

// Get by id
router.get('/:id', async (req, res, next) => {
  try {
    const log = await AuditLog.findOne({ _id: req.params.id, ...tenantFilter(req) })
      .populate('userId', 'name email role');
    if (!log) return res.status(404).json({ success: false, message: 'Log not found' });
    res.json({ success: true, data: log });
  } catch (err) { next(err); }
});

// Aggregate — daily counts (for dashboards)
router.get('/aggregate/daily', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const agg = await AuditLog.aggregate([
      { $match: { organizationId: req.tenantId, timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            category: '$category',
          },
          count: { $sum: 1 },
          criticalCount: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);
    res.json({ success: true, data: agg });
  } catch (err) { next(err); }
});

// Audit summary by user
router.get('/aggregate/by-user', async (req, res, next) => {
  try {
    const period = parseInt(req.query.period) || 30;
    const since = new Date();
    since.setDate(since.getDate() - period);
    const agg = await AuditLog.aggregate([
      { $match: { organizationId: req.tenantId, timestamp: { $gte: since } } },
      {
        $group: {
          _id: { userId: '$userId', userEmail: '$userEmail', userRole: '$userRole' },
          totalActions: { $sum: 1 },
          failedActions: { $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] } },
          deniedActions: { $sum: { $cond: [{ $eq: ['$status', 'denied'] }, 1, 0] } },
          criticalActions: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          lastActivity: { $max: '$timestamp' },
        },
      },
      { $sort: { totalActions: -1 } },
      { $limit: 50 },
    ]);
    res.json({ success: true, data: agg });
  } catch (err) { next(err); }
});

export default router;
