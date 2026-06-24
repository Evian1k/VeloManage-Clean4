import express from 'express';
import Trip from '../../models/Trip.js';
import { createCrudRouter } from '../crudFactory.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantFilter } from '../../middleware/tenant.js';

const router = createCrudRouter(Trip, {
  permissions: { read: 'trips:read', write: 'trips:write', delete: 'trips:delete' },
  category: 'trip',
  searchableFields: ['tripNumber', 'reference', 'driverName', 'customerName'],
  defaultSort: { scheduledStart: -1 },
  population: [
    { path: 'vehicleId', select: 'vehicleId licensePlate make model' },
    { path: 'driverId', select: 'fullName email phone' },
    { path: 'customerId', select: 'name email' },
  ],
});

// Dispatch trip
router.post('/:id/dispatch', requirePermission('trips:write'), async (req, res, next) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
    trip.status = 'dispatched';
    trip.dispatchedBy = req.user._id;
    trip.statusHistory.push({ status: 'dispatched', changedBy: req.user._id });
    await trip.save();
    res.json({ success: true, data: trip, message: 'Trip dispatched' });
  } catch (err) { next(err); }
});

// Start trip
router.post('/:id/start', requirePermission('trips:write'), async (req, res, next) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
    await trip.start(req.user._id);
    res.json({ success: true, data: trip, message: 'Trip started' });
  } catch (err) { next(err); }
});

// Complete trip
router.post('/:id/complete', requirePermission('trips:write'), async (req, res, next) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
    await trip.complete(req.user._id, req.body);
    trip.calculateScore();
    await trip.save();
    res.json({ success: true, data: trip, message: 'Trip completed' });
  } catch (err) { next(err); }
});

// Add event (telematics integration)
router.post('/:id/events', requirePermission('gps:write'), async (req, res, next) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
    await trip.addEvent(req.body.type, req.body);
    res.json({ success: true, data: trip });
  } catch (err) { next(err); }
});

// Add waypoint
router.post('/:id/waypoints', requirePermission('trips:write'), async (req, res, next) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
    trip.waypoints.push(req.body);
    await trip.save();
    res.json({ success: true, data: trip });
  } catch (err) { next(err); }
});

// Update waypoint status (e.g. mark arrived)
router.put('/:id/waypoints/:index', requirePermission('trips:write'), async (req, res, next) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
    const idx = parseInt(req.params.index);
    if (isNaN(idx) || idx < 0 || idx >= trip.waypoints.length) {
      return res.status(400).json({ success: false, message: 'Invalid waypoint index' });
    }
    Object.assign(trip.waypoints[idx], req.body);
    if (req.body.status === 'arrived') trip.waypoints[idx].actualArrival = new Date();
    if (req.body.status === 'departed') trip.waypoints[idx].actualDeparture = new Date();
    await trip.save();
    res.json({ success: true, data: trip });
  } catch (err) { next(err); }
});

// Active trips (real-time dashboard)
router.get('/active/all', requirePermission('trips:read'), async (req, res, next) => {
  try {
    const trips = await Trip.find({
      ...tenantFilter(req),
      status: { $in: ['dispatched', 'in_progress', 'paused'] },
    })
      .populate('vehicleId', 'vehicleId licensePlate currentLocation')
      .populate('driverId', 'fullName phone')
      .sort({ actualStart: -1 });
    res.json({ success: true, data: trips, count: trips.length });
  } catch (err) { next(err); }
});

export default router;
