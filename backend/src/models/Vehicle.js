import mongoose from 'mongoose';

/**
 * Vehicle — superset of the old Truck model.
 *
 * Covers the full fleet lifecycle:
 *   registration → assignment → operation → maintenance → retirement → disposal
 *
 * Multi-tenant: every vehicle belongs to an Organization.
 * Can be assigned to a Branch and/or Driver.
 * Stores lifecycle events, depreciation schedule, documents.
 */
const vehicleSchema = new mongoose.Schema({
  // Tenant
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },

  // Identity
  vehicleId: { type: String, required: true, unique: true, trim: true, uppercase: true },
  vin: { type: String, trim: true, uppercase: true, minlength: 11, maxlength: 17 },
  licensePlate: { type: String, required: true, trim: true, uppercase: true },

  // Classification
  type: {
    type: String,
    enum: ['truck', 'trailer', 'van', 'car', 'motorcycle', 'bus', 'heavy_equipment',
           'tanker', 'refrigerated', 'flatbed', 'container', 'light_vehicle', 'other'],
    required: true,
  },
  category: {
    type: String,
    enum: ['passenger', 'cargo', 'special_purpose', 'public_transport', 'construction'],
    default: 'cargo',
  },
  make: { type: String, trim: true, required: true },
  model: { type: String, trim: true, required: true },
  year: { type: Number, min: 1950, max: new Date().getFullYear() + 1 },
  color: { type: String, trim: true },

  // Specifications
  specifications: {
    fuelType: { type: String, enum: ['petrol', 'diesel', 'electric', 'hybrid', 'cng', 'lpg', 'hydrogen'] },
    engineSize: String, // e.g. "2.4L"
    engineNumber: String,
    transmission: { type: String, enum: ['manual', 'automatic', 'semi_automatic', 'cvt'] },
    drivetrain: { type: String, enum: ['fwd', 'rwd', 'awd', '4wd'] },
    payloadCapacityKg: Number,
    grossVehicleWeightKg: Number,
    seatingCapacity: Number,
    fuelTankCapacityL: Number,
    avgConsumptionLPer100km: Number,
    range: Number, // for electric
    batteryCapacityKwh: Number,
    axles: Number,
    tires: Number,
    dimensions: {
      lengthMm: Number,
      widthMm: Number,
      heightMm: Number,
    },
  },

  // Registration / legal
  registration: {
    number: String,
    issuingAuthority: String,
    issuingCountry: String,
    registeredAt: Date,
    expiresAt: Date,
    documents: [{
      name: String,
      url: String,
      uploadedAt: { type: Date, default: Date.now },
    }],
  },

  // Insurance
  insurance: {
    provider: String,
    policyNumber: String,
    type: { type: String, enum: ['third_party', 'comprehensive', 'fleet'] },
    coverageAmount: Number,
    premium: Number,
    currency: { type: String, default: 'USD' },
    startDate: Date,
    endDate: Date,
    documents: [{ name: String, url: String }],
  },

  // Status & lifecycle
  status: {
    type: String,
    enum: ['active', 'idle', 'in_maintenance', 'out_of_service', 'retired', 'disposed', 'stolen', 'impounded'],
    default: 'active',
    index: true,
  },
  lifecycleStage: {
    type: String,
    enum: ['acquisition', 'registration', 'onboarding', 'operation', 'maintenance', 'pre_retirement', 'retired', 'disposed'],
    default: 'acquisition',
  },

  // Assignment
  assignedDriverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedAt: Date,
  assignmentHistory: [{
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    driverName: String,
    assignedAt: Date,
    unassignedAt: Date,
    reason: String,
  }],

  // Acquisition & financials
  acquisition: {
    date: Date,
    method: { type: String, enum: ['purchase', 'lease', 'rental', 'financing', 'donated'] },
    cost: Number,
    currency: { type: String, default: 'USD' },
    vendor: String,
    financing: {
      provider: String,
      monthlyPayment: Number,
      termMonths: Number,
      interestRate: Number,
      startDate: Date,
      endDate: Date,
      remainingBalance: Number,
    },
    lease: {
      provider: String,
      monthlyPayment: Number,
      termMonths: Number,
      startDate: Date,
      endDate: Date,
      buyoutOption: Number,
      mileageLimitPerYear: Number,
    },
  },

  // Depreciation
  depreciation: {
    method: { type: String, enum: ['straight_line', 'declining_balance', 'units_of_production'], default: 'straight_line' },
    usefulLifeYears: { type: Number, default: 8 },
    salvageValue: { type: Number, default: 0 },
    annualDepreciation: Number,
    currentValue: Number,
    schedule: [{
      year: Number,
      beginningValue: Number,
      depreciation: Number,
      endingValue: Number,
      accumulatedDepreciation: Number,
    }],
  },

  // Odometer & operations
  odometer: {
    current: { type: Number, default: 0 },
    unit: { type: String, enum: ['km', 'mi'], default: 'km' },
    lastUpdated: { type: Date, default: Date.now },
    history: [{
      reading: Number,
      timestamp: { type: Date, default: Date.now },
      source: { type: String, enum: ['gps', 'manual', 'work_order', 'inspection'] },
    }],
  },

  // Telematics
  telematics: {
    deviceId: String,
    provider: String,
    installedAt: Date,
    simCardId: String,
    lastPingAt: Date,
    firmwareVersion: String,
  },

  // Current location (denormalized from GPS tracking)
  currentLocation: {
    latitude: Number,
    longitude: Number,
    address: String,
    heading: Number,
    speed: Number,
    timestamp: { type: Date, default: Date.now },
  },

  // Maintenance summary
  maintenance: {
    lastServiceAt: Date,
    lastServiceMileage: Number,
    nextServiceDueAt: Date,
    nextServiceDueMileage: Number,
    totalMaintenanceCost: { type: Number, default: 0 },
    downtimeHoursYtd: { type: Number, default: 0 },
  },

  // Documents (general)
  documents: [{
    name: String,
    type: { type: String, enum: ['registration', 'insurance', 'inspection', 'permit', 'title', 'manual', 'photo', 'other'] },
    url: String,
    size: Number,
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiresAt: Date,
  }],

  // Custom attributes (for flexibility)
  customFields: { type: Map, of: mongoose.Schema.Types.Mixed },

  // Lifecycle events
  events: [{
    type: { type: String, enum: ['registered', 'assigned', 'unassigned', 'maintenance_started', 'maintenance_completed',
            'accident', 'transfer', 'inspection', 'retired', 'disposed', 'reactivated'] },
    timestamp: { type: Date, default: Date.now },
    description: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    metadata: mongoose.Schema.Types.Mixed,
  }],

  // Status
  isActive: { type: Boolean, default: true, index: true },
  retiredAt: Date,
  disposedAt: Date,
  disposal: {
    method: { type: String, enum: ['sale', 'scrapped', 'trade_in', 'donated', 'auction'] },
    proceeds: Number,
    buyer: String,
    date: Date,
    documents: [{ name: String, url: String }],
  },

  // Tags for categorization
  tags: [{ type: String, trim: true }],
}, { timestamps: true });

// Indexes
vehicleSchema.index({ organizationId: 1, vehicleId: 1 }, { unique: true });
vehicleSchema.index({ organizationId: 1, licensePlate: 1 });
vehicleSchema.index({ organizationId: 1, status: 1, isActive: 1 });
vehicleSchema.index({ organizationId: 1, type: 1 });
vehicleSchema.index({ organizationId: 1, branchId: 1 });
vehicleSchema.index({ organizationId: 1, assignedDriverId: 1 });
vehicleSchema.index({ vin: 1 }, { sparse: true });
vehicleSchema.index({ 'telematics.deviceId': 1 }, { sparse: true });
vehicleSchema.index({ 'currentLocation.latitude': 1, 'currentLocation.longitude': 1 });

// Methods
vehicleSchema.methods.assignToDriver = function(driverId, driverName, reason = '') {
  // Unassign previous
  if (this.assignedDriverId) {
    this.assignmentHistory.push({
      driverId: this.assignedDriverId,
      assignedAt: this.assignedAt,
      unassignedAt: new Date(),
      reason,
    });
  }
  this.assignedDriverId = driverId;
  this.assignedAt = new Date();
  this.events.push({ type: 'assigned', description: `Assigned to ${driverName}`, performedBy: null });
  return this.save();
};

vehicleSchema.methods.unassignDriver = function(reason = '') {
  if (this.assignedDriverId) {
    this.assignmentHistory.push({
      driverId: this.assignedDriverId,
      assignedAt: this.assignedAt,
      unassignedAt: new Date(),
      reason,
    });
    this.assignedDriverId = null;
    this.assignedAt = null;
    this.events.push({ type: 'unassigned', description: reason || 'Unassigned' });
  }
  return this.save();
};

vehicleSchema.methods.updateOdometer = function(reading, source = 'manual') {
  if (reading < this.odometer.current) {
    throw new Error('Odometer cannot go backwards');
  }
  this.odometer.history.push({ reading: this.odometer.current, timestamp: new Date(), source });
  this.odometer.current = reading;
  this.odometer.lastUpdated = new Date();
  return this.save();
};

vehicleSchema.methods.calculateDepreciation = function() {
  if (!this.acquisition?.cost || !this.depreciation?.usefulLifeYears) return this;
  const { method, usefulLifeYears, salvageValue } = this.depreciation;
  const cost = this.acquisition.cost;
  const yearsElapsed = this.acquisition.date
    ? Math.min(usefulLifeYears, (Date.now() - this.acquisition.date.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 0;

  if (method === 'straight_line') {
    const annualDep = (cost - salvageValue) / usefulLifeYears;
    this.depreciation.annualDepreciation = annualDep;
    this.depreciation.currentValue = Math.max(salvageValue, cost - (annualDep * yearsElapsed));
    this.depreciation.schedule = [];
    for (let y = 1; y <= usefulLifeYears; y++) {
      const beginning = cost - (annualDep * (y - 1));
      const ending = Math.max(salvageValue, beginning - annualDep);
      this.depreciation.schedule.push({
        year: y,
        beginningValue: beginning,
        depreciation: annualDep,
        endingValue: ending,
        accumulatedDepreciation: cost - ending,
      });
    }
  }
  return this;
};

vehicleSchema.methods.retire = function(reason, performedBy) {
  this.status = 'retired';
  this.lifecycleStage = 'retired';
  this.retiredAt = new Date();
  this.isActive = false;
  this.events.push({ type: 'retired', description: reason, performedBy });
  return this.save();
};

vehicleSchema.methods.dispose = function(disposalData, performedBy) {
  this.status = 'disposed';
  this.lifecycleStage = 'disposed';
  this.disposedAt = new Date();
  this.isActive = false;
  this.disposal = { ...disposalData, date: new Date() };
  this.events.push({ type: 'disposed', description: `Disposed via ${disposalData.method}`, performedBy });
  return this.save();
};

const Vehicle = mongoose.model('Vehicle', vehicleSchema);
export default Vehicle;
