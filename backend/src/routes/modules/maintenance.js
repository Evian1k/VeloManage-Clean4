import express from 'express';
import MaintenanceWorkOrder from '../../models/MaintenanceWorkOrder.js';
import Part from '../../models/Part.js';
import { createCrudRouter } from '../crudFactory.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantFilter } from '../../middleware/tenant.js';
import { recordAudit } from '../../models/AuditLog.js';

const router = createCrudRouter(MaintenanceWorkOrder, {
  permissions: { read: 'maintenance:read', write: 'maintenance:write', delete: 'maintenance:delete' },
  category: 'maintenance',
  searchableFields: ['workOrderNumber', 'title', 'vehicleInfo.licensePlate'],
  defaultSort: { createdAt: -1 },
  population: [
    { path: 'vehicleId', select: 'vehicleId licensePlate make model' },
    { path: 'assignedTo', select: 'name email' },
    { path: 'approvedBy', select: 'name' },
  ],
});

// Approve work order
router.post('/:id/approve', requirePermission('maintenance:approve'), async (req, res, next) => {
  try {
    const wo = await MaintenanceWorkOrder.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!wo) return res.status(404).json({ success: false, message: 'Work order not found' });
    await wo.approve(req.user._id, req.body.notes || '');
    res.json({ success: true, data: wo, message: 'Work order approved' });
  } catch (err) { next(err); }
});

// Change status
router.post('/:id/status', requirePermission('maintenance:write'), async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'status required' });
    const wo = await MaintenanceWorkOrder.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!wo) return res.status(404).json({ success: false, message: 'Work order not found' });
    await wo.changeStatus(status, req.user._id, notes || '');
    res.json({ success: true, data: wo });
  } catch (err) { next(err); }
});

// Add part usage
router.post('/:id/parts', requirePermission('maintenance:write'), async (req, res, next) => {
  try {
    const wo = await MaintenanceWorkOrder.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!wo) return res.status(404).json({ success: false, message: 'Work order not found' });
    const { partId, quantity } = req.body;
    // Find part to get cost
    const part = await Part.findOne({ _id: partId, ...tenantFilter(req) });
    if (!part) return res.status(404).json({ success: false, message: 'Part not found' });
    if (part.stock.available < quantity) {
      return res.status(400).json({ success: false, message: `Insufficient stock. Available: ${part.stock.available}` });
    }
    await part.reserve(quantity);
    wo.parts.push({
      partId: part._id,
      partName: part.name,
      partNumber: part.partNumber,
      quantity,
      unitCost: part.costing.unitCost,
      totalCost: part.costing.unitCost * quantity,
      currency: part.costing.currency,
    });
    wo.calculateTotal();
    await wo.save();
    res.json({ success: true, data: wo });
  } catch (err) { next(err); }
});

// Add labor
router.post('/:id/labor', requirePermission('maintenance:write'), async (req, res, next) => {
  try {
    const wo = await MaintenanceWorkOrder.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!wo) return res.status(404).json({ success: false, message: 'Work order not found' });
    const { mechanicId, mechanicName, hours, hourlyRate, description } = req.body;
    wo.labor.push({
      mechanicId, mechanicName, hours, hourlyRate,
      totalCost: hours * hourlyRate,
      description,
    });
    wo.calculateTotal();
    await wo.save();
    res.json({ success: true, data: wo });
  } catch (err) { next(err); }
});

// Complete work order
router.post('/:id/complete', requirePermission('maintenance:write'), async (req, res, next) => {
  try {
    const wo = await MaintenanceWorkOrder.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!wo) return res.status(404).json({ success: false, message: 'Work order not found' });
    wo.workPerformed = req.body.workPerformed || wo.workPerformed;
    wo.diagnosis = req.body.diagnosis || wo.diagnosis;
    wo.recommendations = req.body.recommendations || wo.recommendations;
    wo.calculateTotal();
    await wo.save();
    await wo.changeStatus('completed', req.user._id, req.body.notes || '');
    // Consume reserved parts
    for (const partUsage of wo.parts) {
      const part = await Part.findById(partUsage.partId);
      if (part) {
        await part.adjustStock(-partUsage.quantity, 'consumption', wo.workOrderNumber, req.user._id, `WO ${wo.workOrderNumber}`);
        await part.releaseReservation(partUsage.quantity);
      }
    }
    res.json({ success: true, data: wo, message: 'Work order completed' });
  } catch (err) { next(err); }
});

// Upcoming / overdue maintenance
router.get('/schedule/upcoming', requirePermission('maintenance:read'), async (req, res, next) => {
  try {
    const daysAhead = parseInt(req.query.days) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);
    const workOrders = await MaintenanceWorkOrder.find({
      ...tenantFilter(req),
      scheduledAt: { $lte: cutoff, $gte: new Date() },
      status: { $in: ['approved', 'assigned'] },
    }).populate('vehicleId', 'vehicleId licensePlate make model').sort({ scheduledAt: 1 });
    res.json({ success: true, data: workOrders });
  } catch (err) { next(err); }
});

export default router;
