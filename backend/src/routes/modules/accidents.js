import express from 'express';
import Accident from '../../models/Accident.js';
import { createCrudRouter } from '../crudFactory.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantFilter } from '../../middleware/tenant.js';

const router = createCrudRouter(Accident, {
  permissions: { read: 'accidents:read', write: 'accidents:write', delete: 'accidents:delete' },
  category: 'accident',
  searchableFields: ['accidentNumber', 'driverName', 'vehicleInfo.licensePlate', 'description'],
  defaultSort: { occurredAt: -1 },
  population: [
    { path: 'vehicleId', select: 'vehicleId licensePlate make model' },
    { path: 'driverId', select: 'fullName email phone' },
    { path: 'reportedBy', select: 'name' },
    { path: 'assignedTo', select: 'name email' },
  ],
});

// Add evidence
router.post('/:id/evidence', requirePermission('accidents:write'), async (req, res, next) => {
  try {
    const accident = await Accident.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!accident) return res.status(404).json({ success: false, message: 'Accident not found' });
    accident.evidence.push({ ...req.body, uploadedBy: req.user._id });
    await accident.save();
    res.json({ success: true, data: accident });
  } catch (err) { next(err); }
});

// Add involved party
router.post('/:id/parties', requirePermission('accidents:write'), async (req, res, next) => {
  try {
    const accident = await Accident.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!accident) return res.status(404).json({ success: false, message: 'Accident not found' });
    accident.involvedParties.push(req.body);
    await accident.save();
    res.json({ success: true, data: accident });
  } catch (err) { next(err); }
});

// File insurance claim
router.post('/:id/insurance-claim', requirePermission('accidents:write'), async (req, res, next) => {
  try {
    const accident = await Accident.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!accident) return res.status(404).json({ success: false, message: 'Accident not found' });
    accident.insurance = {
      ...accident.insurance,
      ...req.body,
      claimFiled: true,
      filedAt: new Date(),
      status: 'filed',
    };
    await accident.save();
    res.json({ success: true, data: accident, message: 'Insurance claim filed' });
  } catch (err) { next(err); }
});

// Change status
router.post('/:id/status', requirePermission('accidents:write'), async (req, res, next) => {
  try {
    const accident = await Accident.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!accident) return res.status(404).json({ success: false, message: 'Accident not found' });
    await accident.changeStatus(req.body.status, req.user._id, req.body.notes || '');
    res.json({ success: true, data: accident });
  } catch (err) { next(err); }
});

// Calculate financial impact
router.post('/:id/calculate-financials', requirePermission('accidents:read'), async (req, res, next) => {
  try {
    const accident = await Accident.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!accident) return res.status(404).json({ success: false, message: 'Accident not found' });
    accident.calculateFinancialImpact();
    await accident.save();
    res.json({ success: true, data: accident.financialImpact });
  } catch (err) { next(err); }
});

export default router;
