import express from 'express';
import Driver from '../../models/Driver.js';
import User from '../../models/User.js';
import Vehicle from '../../models/Vehicle.js';
import { createCrudRouter } from '../crudFactory.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantFilter } from '../../middleware/tenant.js';
import { recordAudit } from '../../models/AuditLog.js';

const router = createCrudRouter(Driver, {
  permissions: { read: 'drivers:read', write: 'drivers:write', delete: 'drivers:delete' },
  category: 'driver',
  searchableFields: ['employeeId', 'fullName', 'email', 'phone', 'license.number'],
  defaultSort: { createdAt: -1 },
  population: [
    { path: 'userId', select: 'name email phone role' },
    { path: 'assignedVehicleId', select: 'vehicleId licensePlate make model' },
    { path: 'branchId', select: 'name' },
  ],
});

// Create driver with linked user account
router.post('/', requirePermission('drivers:write'), async (req, res, next) => {
  try {
    const { user: userData, driver: driverData } = req.body;
    // If user data provided, create the user account first
    let userId = driverData.userId;
    if (userData && !userId) {
      const existingUser = await User.findOne({ email: userData.email.toLowerCase() });
      if (existingUser) {
        userId = existingUser._id;
      } else {
        const newUser = new User({
          name: userData.name || driverData.fullName,
          email: userData.email,
          password: userData.password,
          phone: userData.phone || driverData.phone,
          organizationId: req.tenantId,
          role: userData.role || 'driver',
          isActive: true,
        });
        await newUser.save();
        userId = newUser._id;
      }
    }
    const driver = new Driver({
      ...driverData,
      userId,
      organizationId: req.tenantId,
      createdBy: req.user._id,
    });
    await driver.save();

    await recordAudit({
      userId: req.user._id, userRole: req.user.role, userEmail: req.user.email,
      organizationId: req.tenantId, ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      action: 'driver.create', category: 'driver',
      status: 'success', statusCode: 201, method: 'POST', path: req.originalUrl,
      resourceType: 'Driver', resourceId: driver._id.toString(),
      resourceName: driver.fullName,
      after: driver.toJSON(),
    });
    res.status(201).json({ success: true, data: driver, message: 'Driver created' });
  } catch (err) { next(err); }
});

// Add violation
router.post('/:id/violations', requirePermission('drivers:write'), async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
    await driver.addViolation(req.body);
    res.json({ success: true, data: driver, message: 'Violation added' });
  } catch (err) { next(err); }
});

// Add reward
router.post('/:id/rewards', requirePermission('drivers:write'), async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
    await driver.addReward(req.body);
    res.json({ success: true, data: driver, message: 'Reward added' });
  } catch (err) { next(err); }
});

// Add certification
router.post('/:id/certifications', requirePermission('drivers:write'), async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
    driver.certifications.push(req.body);
    await driver.save();
    res.json({ success: true, data: driver });
  } catch (err) { next(err); }
});

// Add training
router.post('/:id/training', requirePermission('drivers:write'), async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
    driver.training.push(req.body);
    await driver.save();
    res.json({ success: true, data: driver });
  } catch (err) { next(err); }
});

// Assign vehicle
router.post('/:id/assign-vehicle', requirePermission('drivers:write'), async (req, res, next) => {
  try {
    const { vehicleId } = req.body;
    if (!vehicleId) return res.status(400).json({ success: false, message: 'vehicleId required' });
    const driver = await Driver.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
    const vehicle = await Vehicle.findOne({ _id: vehicleId, ...tenantFilter(req) });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    await driver.assignVehicle(vehicle._id, vehicle.vehicleId, 'Manual assignment');
    await vehicle.assignToDriver(driver._id, driver.fullName, 'Driver-assigned vehicle');
    res.json({ success: true, data: driver, message: 'Vehicle assigned' });
  } catch (err) { next(err); }
});

// License expiry check
router.get('/license-expiry/due', requirePermission('drivers:read'), async (req, res, next) => {
  try {
    const daysAhead = parseInt(req.query.days) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);
    const drivers = await Driver.find({
      ...tenantFilter(req),
      'license.expiresAt': { $lte: cutoff, $gte: new Date() },
      isActive: true,
    }).select('fullName email phone license license.status');
    res.json({ success: true, data: drivers, count: drivers.length });
  } catch (err) { next(err); }
});

// Driver score leaderboard
router.get('/leaderboard/scores', requirePermission('drivers:read'), async (req, res, next) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const drivers = await Driver.find({ ...tenantFilter(req), isActive: true })
      .sort({ 'score.overall': -1 })
      .limit(limit)
      .select('fullName employeeId score.stats.totalTrips');
    res.json({ success: true, data: drivers });
  } catch (err) { next(err); }
});

export default router;
