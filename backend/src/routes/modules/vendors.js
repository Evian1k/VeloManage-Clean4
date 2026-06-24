import express from 'express';
import Vendor from '../../models/Vendor.js';
import PurchaseOrder from '../../models/PurchaseOrder.js';
import { createCrudRouter } from '../crudFactory.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantFilter } from '../../middleware/tenant.js';

const router = createCrudRouter(Vendor, {
  permissions: { read: 'vendors:read', write: 'vendors:write', delete: 'vendors:delete' },
  category: 'vendor',
  searchableFields: ['vendorId', 'name', 'legalName', 'contact.primaryEmail'],
  defaultSort: { createdAt: -1 },
});

// Add performance evaluation
router.post('/:id/evaluation', requirePermission('vendors:write'), async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    await vendor.addEvaluation({
      ...req.body,
      evaluatedBy: req.user._id,
      evaluatedAt: new Date(),
    });
    res.json({ success: true, data: vendor });
  } catch (err) { next(err); }
});

// Vendor portal invitation
router.post('/:id/invite-portal', requirePermission('vendors:write'), async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    // In production: create a vendor-portal user with limited role, send email
    vendor.portalAccess.enabled = true;
    vendor.portalAccess.invitedAt = new Date();
    await vendor.save();
    res.json({ success: true, message: 'Vendor portal invitation sent' });
  } catch (err) { next(err); }
});

// ─── Purchase Orders ──────────────────────────────────────────────────────
const poRouter = createCrudRouter(PurchaseOrder, {
  permissions: { read: 'procurement:read', write: 'procurement:write', delete: 'procurement:delete' },
  category: 'procurement',
  searchableFields: ['poNumber', 'title', 'vendorName'],
  defaultSort: { createdAt: -1 },
  population: [
    { path: 'vendorId', select: 'name contact' },
    { path: 'requestedBy', select: 'name email' },
  ],
});

// Approve PO
poRouter.post('/:id/approve', requirePermission('procurement:approve'), async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    po.calculateTotals();
    await po.approve(req.user._id, req.body.comments || '');
    res.json({ success: true, data: po, message: 'PO approved' });
  } catch (err) { next(err); }
});

// Reject PO
poRouter.post('/:id/reject', requirePermission('procurement:approve'), async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    await po.reject(req.user._id, req.body.reason);
    res.json({ success: true, data: po, message: 'PO rejected' });
  } catch (err) { next(err); }
});

// Receive PO line item
poRouter.post('/:id/receive', requirePermission('procurement:write'), async (req, res, next) => {
  try {
    const { lineNumber, quantityReceived, quantityRejected } = req.body;
    const po = await PurchaseOrder.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    await po.receiveItem(lineNumber, quantityReceived, quantityRejected || 0);
    res.json({ success: true, data: po });
  } catch (err) { next(err); }
});

router.use('/purchase-orders', poRouter);

export default router;
