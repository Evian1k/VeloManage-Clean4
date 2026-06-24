import mongoose from 'mongoose';

/**
 * Trip — planned or actual journey of a vehicle.
 * Covers: planning, dispatch, in-progress, completion, history.
 */

const waypointSchema = new mongoose.Schema({
  type: { type: String, enum: ['origin', 'destination', 'waypoint', 'rest_stop', 'fuel_stop', 'pickup', 'dropoff'] },
  name: String,
  address: String,
  latitude: Number,
  longitude: Number,
  scheduledArrival: Date,
  actualArrival: Date,
  scheduledDeparture: Date,
  actualDeparture: Date,
  notes: String,
  contactName: String,
  contactPhone: String,
  cargo: [{
    description: String,
    quantity: Number,
    weight: Number,
    unit: String,
  }],
  status: { type: String, enum: ['pending', 'arrived', 'departed', 'skipped', 'failed'], default: 'pending' },
}, { _id: false });

const tripEventSchema = new mongoose.Schema({
  type: { type: String, enum: ['start', 'pause', 'resume', 'arrive', 'depart', 'complete', 'cancel', 'deviation',
          'speeding', 'harsh_braking', 'harsh_acceleration', 'sharp_turn', 'idle', 'geofence_enter', 'geofence_exit',
          'fuel_stop', 'rest_start', 'rest_end', 'emergency'] },
  timestamp: { type: Date, default: Date.now },
  location: { latitude: Number, longitude: Number, address: String },
  value: Number, // e.g. speed value, fuel quantity
  metadata: mongoose.Schema.Types.Mixed,
}, { _id: false });

const tripSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

  tripNumber: { type: String, required: true, unique: true },
  reference: String, // customer reference / PO number
  externalReference: String,

  // Type & purpose
  type: {
    type: String,
    enum: ['delivery', 'pickup', 'transfer', 'maintenance_run', 'inspection', 'other'],
    default: 'delivery',
  },
  purpose: String,
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },

  // Assignment
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
  vehicleInfo: { vehicleId: String, licensePlate: String },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
  driverName: String,
  coDriverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  coDriverName: String,

  // Route
  waypoints: [waypointSchema],
  route: {
    distanceKm: Number,
    estimatedDurationMin: Number,
    actualDistanceKm: Number,
    actualDurationMin: Number,
    optimized: { type: Boolean, default: false },
    polyline: String, // encoded route geometry
    tollsCost: Number,
    fuelEstimateL: Number,
    fuelEstimateCost: Number,
  },

  // Schedule
  scheduledStart: Date,
  scheduledEnd: Date,
  actualStart: Date,
  actualEnd: Date,

  // Status
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'dispatched', 'in_progress', 'paused', 'completed', 'cancelled', 'failed', 'no_show'],
    default: 'draft',
    index: true,
  },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String,
  }],

  // Cargo
  cargo: [{
    description: { type: String, required: true },
    type: { type: String, enum: ['general', 'hazardous', 'perishable', 'fragile', 'livestock', 'bulk', 'container'] },
    quantity: Number,
    weight: Number,
    volume: Number,
    unit: String,
    declaredValue: Number,
    currency: String,
    trackingNumber: String,
    recipientName: String,
    recipientPhone: String,
    status: { type: String, enum: ['pending', 'loaded', 'in_transit', 'delivered', 'damaged', 'lost'], default: 'pending' },
    deliveredAt: Date,
    deliverySignature: String, // URL to signature image
    deliveryPhotoUrl: String,
  }],

  // Events (telematics-driven)
  events: [tripEventSchema],

  // Performance
  performance: {
    avgSpeedKmh: Number,
    maxSpeedKmh: Number,
    fuelConsumedL: Number,
    fuelCost: Number,
    idleTimeMin: Number,
    drivingTimeMin: Number,
    restTimeMin: Number,
    deviations: Number,
    speedingEvents: Number,
    harshEvents: Number,
    score: Number, // 0-100
  },

  // Customer / Customer Reference
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerName: String,
  contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract' },

  // Pricing
  pricing: {
    baseRate: Number,
    perKmRate: Number,
    perHourRate: Number,
    fuelSurcharge: Number,
    tolls: Number,
    additionalCharges: Number,
    totalAmount: Number,
    currency: { type: String, default: 'USD' },
    invoiced: { type: Boolean, default: false },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinanceTransaction' },
  },

  // Compliance
  compliance: {
    hosCompliant: { type: Boolean, default: true },
    hosViolations: [String],
    requiredRestBreaks: Number,
    takenRestBreaks: Number,
    requiredDocuments: [String],
    attachedDocuments: [String],
  },

  // Notes
  notes: String,
  cancellationReason: String,

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

tripSchema.index({ organizationId: 1, tripNumber: 1 }, { unique: true });
tripSchema.index({ organizationId: 1, status: 1, scheduledStart: 1 });
tripSchema.index({ organizationId: 1, vehicleId: 1, createdAt: -1 });
tripSchema.index({ organizationId: 1, driverId: 1, createdAt: -1 });
tripSchema.index({ organizationId: 1, customerId: 1 });

tripSchema.methods.start = function(userId) {
  this.status = 'in_progress';
  this.actualStart = new Date();
  this.statusHistory.push({ status: 'in_progress', changedBy: userId });
  this.events.push({ type: 'start', timestamp: new Date() });
  return this.save();
};

tripSchema.methods.complete = function(userId, completionData = {}) {
  this.status = 'completed';
  this.actualEnd = new Date();
  this.statusHistory.push({ status: 'completed', changedBy: userId });
  this.events.push({ type: 'complete', timestamp: new Date(), metadata: completionData });
  if (this.actualStart) {
    this.route.actualDurationMin = (this.actualEnd - this.actualStart) / (60 * 1000);
  }
  return this.save();
};

tripSchema.methods.addEvent = function(eventType, data = {}) {
  this.events.push({ type: eventType, timestamp: new Date(), ...data });
  // Auto-flag speeding
  if (eventType === 'speeding') this.performance.speedingEvents += 1;
  if (['harsh_braking', 'harsh_acceleration', 'sharp_turn'].includes(eventType)) {
    this.performance.harshEvents += 1;
  }
  return this.save();
};

tripSchema.methods.calculateScore = function() {
  let score = 100;
  if (this.performance.speedingEvents > 0) score -= this.performance.speedingEvents * 5;
  if (this.performance.harshEvents > 0) score -= this.performance.harshEvents * 3;
  if (this.performance.deviations > 0) score -= this.performance.deviations * 4;
  if (this.performance.idleTimeMin > 60) score -= 5;
  this.performance.score = Math.max(0, Math.min(100, score));
  return this;
};

const Trip = mongoose.model('Trip', tripSchema);
export default Trip;
