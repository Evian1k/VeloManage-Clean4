import mongoose from 'mongoose';

/**
 * Geofence — virtual perimeter for vehicles.
 * Powers: arrival/departure alerts, unauthorized movement, idle detection, route compliance.
 */

const geofenceSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

  name: { type: String, required: true, trim: true },
  description: String,
  type: {
    type: String,
    enum: ['circle', 'polygon', 'rectangle'],
    required: true,
  },

  // Geometry
  // For circle: center + radiusM
  // For polygon: array of points
  // For rectangle: northEast + southWest
  center: {
    latitude: Number,
    longitude: Number,
  },
  radiusM: { type: Number }, // for circle
  polygon: [{
    latitude: Number,
    longitude: Number,
  }],
  bounds: {
    northEast: { latitude: Number, longitude: Number },
    southWest: { latitude: Number, longitude: Number },
  },

  // Category / purpose
  category: {
    type: String,
    enum: ['office', 'warehouse', 'customer_site', 'fuel_station', 'rest_area',
           'restricted_zone', 'delivery_zone', 'pickup_zone', 'border', 'custom'],
    default: 'custom',
  },

  // Rules
  rules: {
    onEnter: [{
      action: { type: String, enum: ['alert_admin', 'alert_driver', 'log_event', 'start_idle_timer', 'trigger_geofence_report'] },
      recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      message: String,
    }],
    onExit: [{
      action: { type: String, enum: ['alert_admin', 'alert_driver', 'log_event', 'stop_idle_timer', 'trigger_geofence_report', 'immobilize_vehicle'] },
      recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      message: String,
    }],
    onDwell: [{
      action: { type: String, enum: ['alert_admin', 'alert_driver', 'log_event'] },
      recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      thresholdMinutes: Number,
      message: String,
    }],
    maxSpeedKmh: Number, // speed limit inside geofence
    allowIdle: { type: Boolean, default: true },
    maxIdleMinutes: Number,
    unauthorizedHours: { start: String, end: String }, // movement not allowed between these hours
  },

  // Applicability
  appliesTo: {
    allVehicles: { type: Boolean, default: true },
    vehicleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' }],
    vehicleTypes: [String],
    driverIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Driver' }],
  },

  // Schedule (when geofence is active)
  schedule: {
    isAlways: { type: Boolean, default: true },
    daysOfWeek: [String], // ['mon', 'tue']
    startTime: String, // '08:00'
    endTime: String,
    timezone: { type: String, default: 'UTC' },
  },

  // Status
  isActive: { type: Boolean, default: true, index: true },
  color: { type: String, default: '#2563eb' }, // for map rendering

  // Stats
  stats: {
    totalEntries: { type: Number, default: 0 },
    totalExits: { type: Number, default: 0 },
    totalAlerts: { type: Number, default: 0 },
    lastEntryAt: Date,
    lastExitAt: Date,
    lastVehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  },

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

geofenceSchema.index({ organizationId: 1, name: 1 });
geofenceSchema.index({ organizationId: 1, isActive: 1, category: 1 });
geofenceSchema.index({ 'center.latitude': 1, 'center.longitude': 1 });

// Methods
geofenceSchema.methods.containsPoint = function(latitude, longitude) {
  if (this.type === 'circle' && this.center) {
    const R = 6371000; // Earth radius in meters
    const dLat = (latitude - this.center.latitude) * Math.PI / 180;
    const dLon = (longitude - this.center.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.center.latitude * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance <= this.radiusM;
  }
  if (this.type === 'rectangle' && this.bounds?.northEast && this.bounds?.southWest) {
    return latitude >= this.bounds.southWest.latitude &&
           latitude <= this.bounds.northEast.latitude &&
           longitude >= this.bounds.southWest.longitude &&
           longitude <= this.bounds.northEast.longitude;
  }
  if (this.type === 'polygon' && this.polygon?.length >= 3) {
    // Ray casting algorithm
    let inside = false;
    for (let i = 0, j = this.polygon.length - 1; i < this.polygon.length; j = i++) {
      const xi = this.polygon[i].longitude, yi = this.polygon[i].latitude;
      const xj = this.polygon[j].longitude, yj = this.polygon[j].latitude;
      const intersect = ((yi > latitude) !== (yj > latitude)) &&
        (longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  return false;
};

geofenceSchema.methods.recordEntry = function(vehicleId) {
  this.stats.totalEntries += 1;
  this.stats.lastEntryAt = new Date();
  this.stats.lastVehicleId = vehicleId;
  return this.save();
};

geofenceSchema.methods.recordExit = function(vehicleId) {
  this.stats.totalExits += 1;
  this.stats.lastExitAt = new Date();
  return this.save();
};

const Geofence = mongoose.model('Geofence', geofenceSchema);
export default Geofence;
