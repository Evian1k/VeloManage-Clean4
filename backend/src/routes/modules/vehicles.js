import express from 'express';
import Vehicle from '../../models/Vehicle.js';
import Driver from '../../models/Driver.js';
import { createCrudRouter } from '../crudFactory.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantFilter } from '../../middleware/tenant.js';
import { recordAudit } from '../../models/AuditLog.js';

// ─── Vehicle CRUD ───────────────────────────────────────────────────────────
const router = createCrudRouter(Vehicle, {
  permissions: { read: 'vehicles:read', write: 'vehicles:write', delete: 'vehicles:delete' },
  category: 'vehicle',
  searchableFields: ['vehicleId', 'licensePlate', 'vin', 'make', 'model'],
  defaultSort: { createdAt: -1 },
  population: [
    { path: 'assignedDriverId', select: 'fullName email phone' },
    { path: 'branchId', select: 'name' },
  ],
});

// ─── Vehicle: Assign driver ─────────────────────────────────────────────────
router.post('/:id/assign-driver', requirePermission('vehicles:write'), async (req, res, next) => {
  try {
    const { driverId } = req.body;
    if (!driverId) return res.status(400).json({ success: false, message: 'driverId required' });

    const vehicle = await Vehicle.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    const driver = await Driver.findOne({ _id: driverId, ...tenantFilter(req) });
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    await vehicle.assignToDriver(driver._id, driver.fullName, 'Manual assignment via API');
    await driver.assignVehicle(vehicle._id, vehicle.vehicleId, 'Vehicle assignment');

    await recordAudit({
      userId: req.user._id, userRole: req.user.role, userEmail: req.user.email,
      organizationId: req.tenantId, ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      action: 'vehicle.assign_driver', category: 'vehicle',
      status: 'success', method: 'POST', path: req.originalUrl,
      resourceType: 'Vehicle', resourceId: vehicle._id.toString(),
    });
    res.json({ success: true, data: vehicle, message: 'Driver assigned' });
  } catch (err) { next(err); }
});

// ─── Vehicle: Unassign driver ───────────────────────────────────────────────
router.post('/:id/unassign-driver', requirePermission('vehicles:write'), async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    await vehicle.unassignDriver(req.body.reason || 'Manual unassign');
    res.json({ success: true, data: vehicle, message: 'Driver unassigned' });
  } catch (err) { next(err); }
});

// ─── Vehicle: Update location ───────────────────────────────────────────────
router.put('/:id/location', requirePermission('gps:write'), async (req, res, next) => {
  try {
    const { latitude, longitude, address, heading, speed } = req.body;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ success: false, message: 'latitude and longitude (numbers) required' });
    }
    const vehicle = await Vehicle.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    vehicle.currentLocation = { latitude, longitude, address, heading, speed, timestamp: new Date() };
    vehicle.lastSeen = new Date();
    await vehicle.save();
    res.json({ success: true, data: vehicle.currentLocation });
  } catch (err) { next(err); }
});

// ─── Vehicle: Update odometer ───────────────────────────────────────────────
router.post('/:id/odometer', requirePermission('vehicles:write'), async (req, res, next) => {
  try {
    const { reading, source = 'manual' } = req.body;
    const vehicle = await Vehicle.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    await vehicle.updateOdometer(reading, source);
    res.json({ success: true, data: { odometer: vehicle.odometer } });
  } catch (err) { next(err); }
});

// ─── Vehicle: Lifecycle (retire / dispose / reactivate) ─────────────────────
router.post('/:id/retire', requirePermission('vehicles:write'), async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    await vehicle.retire(req.body.reason || 'Retired', req.user._id);
    res.json({ success: true, data: vehicle, message: 'Vehicle retired' });
  } catch (err) { next(err); }
});

router.post('/:id/dispose', requirePermission('vehicles:write'), async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    await vehicle.dispose(req.body, req.user._id);
    res.json({ success: true, data: vehicle, message: 'Vehicle disposed' });
  } catch (err) { next(err); }
});

// ─── Vehicle: Depreciation calculation ──────────────────────────────────────
router.post('/:id/calculate-depreciation', requirePermission('vehicles:read'), async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    vehicle.calculateDepreciation();
    await vehicle.save();
    res.json({ success: true, data: vehicle.depreciation });
  } catch (err) { next(err); }
});

// ─── Vehicle: Lifecycle history ─────────────────────────────────────────────
router.get('/:id/history', requirePermission('vehicles:read'), async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.id, ...tenantFilter(req) })
      .select('events assignmentHistory odometer.history');
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    res.json({ success: true, data: vehicle });
  } catch (err) { next(err); }
});

export default router;
