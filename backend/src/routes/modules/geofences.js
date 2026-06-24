import express from 'express';
import Geofence from '../../models/Geofence.js';
import Vehicle from '../../models/Vehicle.js';
import { createCrudRouter } from '../crudFactory.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantFilter } from '../../middleware/tenant.js';

const router = createCrudRouter(Geofence, {
  permissions: { read: 'gps:read', write: 'gps:write', delete: 'gps:write' },
  category: 'gps',
  searchableFields: ['name', 'description', 'category'],
  defaultSort: { createdAt: -1 },
});

// Check if a point is inside any geofence
router.post('/check-point', requirePermission('gps:read'), async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ success: false, message: 'latitude and longitude required' });
    }
    const geofences = await Geofence.find({ ...tenantFilter(req), isActive: true });
    const matches = geofences.filter(g => g.containsPoint(latitude, longitude));
    res.json({
      success: true,
      inside: matches.map(g => ({
        id: g._id, name: g.name, category: g.category,
        rules: g.rules,
      })),
    });
  } catch (err) { next(err); }
});

// Get vehicles currently inside a geofence
router.get('/:id/vehicles', requirePermission('gps:read'), async (req, res, next) => {
  try {
    const geofence = await Geofence.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!geofence) return res.status(404).json({ success: false, message: 'Geofence not found' });
    const vehicles = await Vehicle.find({
      ...tenantFilter(req),
      'currentLocation.latitude': { $exists: true },
      isActive: true,
    });
    const inside = vehicles.filter(v =>
      v.currentLocation?.latitude && geofence.containsPoint(v.currentLocation.latitude, v.currentLocation.longitude)
    );
    res.json({ success: true, data: inside, count: inside.length });
  } catch (err) { next(err); }
});

export default router;
