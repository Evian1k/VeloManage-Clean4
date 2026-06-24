import express from 'express';
import Asset from '../../models/Asset.js';
import { createCrudRouter } from '../crudFactory.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantFilter } from '../../middleware/tenant.js';

const router = createCrudRouter(Asset, {
  permissions: { read: 'assets:read', write: 'assets:write', delete: 'assets:delete' },
  category: 'asset',
  searchableFields: ['assetId', 'name', 'serialNumber', 'brand', 'model'],
  defaultSort: { createdAt: -1 },
});

// Assign asset
router.post('/:id/assign', requirePermission('assets:write'), async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    // Push existing assignment to history
    if (asset.assignedTo && asset.assignedTo.type !== 'unassigned') {
      asset.assignmentHistory.push({
        assignedTo: asset.assignedTo,
        assignedAt: asset.assignmentHistory.length ? asset.assignmentHistory[asset.assignmentHistory.length - 1].assignedAt : asset.updatedAt,
        unassignedAt: new Date(),
        reason: 'Reassignment',
      });
    }
    asset.assignedTo = req.body;
    asset.status = 'in_use';
    await asset.save();
    res.json({ success: true, data: asset, message: 'Asset assigned' });
  } catch (err) { next(err); }
});

// Calculate depreciation
router.post('/:id/calculate-depreciation', requirePermission('assets:read'), async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    asset.calculateDepreciation();
    await asset.save();
    res.json({ success: true, data: asset.depreciation });
  } catch (err) { next(err); }
});

// Audit asset (record physical verification)
router.post('/:id/audit', requirePermission('assets:write'), async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    asset.lastAuditAt = new Date();
    asset.lastAuditBy = req.user._id;
    asset.lastAuditResult = req.body.result || 'found';
    asset.auditHistory.push({
      auditedAt: new Date(),
      auditedBy: req.user._id,
      result: req.body.result || 'found',
      notes: req.body.notes,
    });
    await asset.save();
    res.json({ success: true, data: asset });
  } catch (err) { next(err); }
});

export default router;
