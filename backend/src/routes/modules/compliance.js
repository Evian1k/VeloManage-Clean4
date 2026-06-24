import express from 'express';
import Compliance from '../../models/Compliance.js';
import { createCrudRouter } from '../crudFactory.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantFilter } from '../../middleware/tenant.js';

const router = createCrudRouter(Compliance, {
  permissions: { read: 'compliance:read', write: 'compliance:write', delete: 'compliance:delete' },
  category: 'compliance',
  searchableFields: ['recordNumber', 'type', 'subjectName', 'authority.name'],
  defaultSort: { validUntil: 1 },
  population: [{ path: 'subjectId', select: 'name vehicleId licensePlate fullName' }],
});

// Expiring soon
router.get('/expiring/all', requirePermission('compliance:read'), async (req, res, next) => {
  try {
    const daysAhead = parseInt(req.query.days) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);
    const records = await Compliance.find({
      ...tenantFilter(req),
      validUntil: { $lte: cutoff, $gte: new Date() },
      status: { $ne: 'expired' },
    }).sort({ validUntil: 1 });
    res.json({ success: true, data: records, count: records.length });
  } catch (err) { next(err); }
});

// Overdue
router.get('/overdue/all', requirePermission('compliance:read'), async (req, res, next) => {
  try {
    const records = await Compliance.find({
      ...tenantFilter(req),
      validUntil: { $lt: new Date() },
      status: { $ne: 'expired' },
    }).sort({ validUntil: 1 });
    res.json({ success: true, data: records, count: records.length });
  } catch (err) { next(err); }
});

// Check & refresh status on a record
router.post('/:id/check-expiry', requirePermission('compliance:read'), async (req, res, next) => {
  try {
    const record = await Compliance.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    record.checkExpiry();
    await record.save();
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
});

export default router;
