import mongoose from 'mongoose';

/**
 * Driver — professional driver profile, separate from User account.
 *
 * Links to User (auth) + Vehicle (assignment) + Organization (tenant).
 * Tracks: license, certifications, training, scoring, violations, rewards, penalties.
 */

const certificationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  issuingAuthority: String,
  certificateNumber: String,
  issuedAt: Date,
  expiresAt: Date,
  status: { type: String, enum: ['valid', 'expiring', 'expired', 'revoked'], default: 'valid' },
  documentUrl: String,
}, { _id: false });

const trainingSchema = new mongoose.Schema({
  course: { type: String, required: true },
  provider: String,
  completedAt: { type: Date, default: Date.now },
  score: Number,
  certificateUrl: String,
  validUntil: Date,
  hoursCompleted: Number,
}, { _id: false });

const violationSchema = new mongoose.Schema({
  type: { type: String, required: true },
  description: String,
  severity: { type: String, enum: ['minor', 'major', 'critical'], default: 'minor' },
  date: { type: Date, default: Date.now },
  location: String,
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['reported', 'investigating', 'confirmed', 'dismissed', 'resolved'], default: 'reported' },
  penaltyPoints: { type: Number, default: 0 },
  fine: Number,
  currency: String,
  evidence: [{ name: String, url: String }],
  resolvedAt: Date,
  resolutionNotes: String,
}, { _id: false });

const rewardSchema = new mongoose.Schema({
  type: { type: String, enum: ['safe_driving', 'fuel_efficiency', 'punctuality', 'customer_service', 'milestone', 'other'] },
  description: String,
  awardedAt: { type: Date, default: Date.now },
  awardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  value: Number,
  currency: String,
  points: Number,
}, { _id: false });

const driverSchema = new mongoose.Schema({
  // Tenant
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

  // Link to user account
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

  // Personal (denormalized from User for quick access)
  employeeId: { type: String, trim: true },
  fullName: { type: String, required: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  photo: String,

  // License
  license: {
    number: { type: String, required: true },
    class: [String], // e.g. ['B', 'C', 'CE']
    issuingCountry: { type: String, default: 'KE' },
    issuingAuthority: String,
    issuedAt: Date,
    expiresAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['valid', 'expiring', 'expired', 'suspended', 'revoked'], default: 'valid' },
    documentUrl: String,
    conditions: [String], // e.g. ['must_wear_glasses']
  },

  // Employment
  employment: {
    type: { type: String, enum: ['full_time', 'part_time', 'contract', 'temporary', 'owner_operator'], default: 'full_time' },
    status: { type: String, enum: ['active', 'on_leave', 'suspended', 'terminated', 'retired'], default: 'active', index: true },
    hiredAt: { type: Date, default: Date.now },
    terminatedAt: Date,
    terminationReason: String,
    contractEndDate: Date,
    salary: {
      base: Number,
      currency: { type: String, default: 'USD' },
      perKmRate: Number,
      perTripRate: Number,
      overtimeRate: Number,
    },
  },

  // Assignment
  assignedVehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  assignmentHistory: [{
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    vehicleIdStr: String,
    assignedAt: Date,
    unassignedAt: Date,
    reason: String,
  }],

  // Qualifications
  certifications: [certificationSchema],
  training: [trainingSchema],

  // Performance & behavior
  score: {
    overall: { type: Number, default: 100, min: 0, max: 100 },
    safety: { type: Number, default: 100, min: 0, max: 100 },
    efficiency: { type: Number, default: 100, min: 0, max: 100 },
    punctuality: { type: Number, default: 100, min: 0, max: 100 },
    customerService: { type: Number, default: 100, min: 0, max: 100 },
    lastCalculatedAt: Date,
    trend: [{ timestamp: Date, score: Number }],
  },

  // Records
  violations: [violationSchema],
  rewards: [rewardSchema],
  penaltyPoints: { type: Number, default: 0 },

  // Stats
  stats: {
    totalTrips: { type: Number, default: 0 },
    totalDistanceKm: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    totalFuelConsumedL: { type: Number, default: 0 },
    accidentsCount: { type: Number, default: 0 },
    incidentsCount: { type: Number, default: 0 },
    lastTripAt: Date,
  },

  // Health
  medical: {
    lastCheckupAt: Date,
    nextCheckupDueAt: Date,
    fitnessStatus: { type: String, enum: ['fit', 'restricted', 'unfit'], default: 'fit' },
    conditions: [String],
    bloodPressure: String,
    visionTest: { type: String, enum: ['pass', 'fail', 'pending'] },
    documentUrl: String,
  },

  // Working hours (HoS — hours of service compliance)
  hoursOfService: {
    today: {
      driving: { type: Number, default: 0 },
      onDuty: { type: Number, default: 0 },
      offDuty: { type: Number, default: 0 },
      rest: { type: Number, default: 0 },
    },
    cycle: {
      driving: { type: Number, default: 0 },
      onDuty: { type: Number, default: 0 },
      cycleStart: Date,
    },
    lastReset: Date,
    violations: [{ timestamp: Date, type: String, description: String }],
  },

  // Status
  isActive: { type: Boolean, default: true, index: true },
  isAvailable: { type: Boolean, default: true }, // available for dispatch
  currentStatus: {
    type: String,
    enum: ['off_duty', 'on_duty', 'driving', 'loading', 'unloading', 'resting', 'emergency'],
    default: 'off_duty',
  },

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Indexes
driverSchema.index({ organizationId: 1, employeeId: 1 }, { sparse: true });
driverSchema.index({ organizationId: 1, 'employment.status': 1, isActive: 1 });
driverSchema.index({ organizationId: 1, 'license.expiresAt': 1 });
driverSchema.index({ organizationId: 1, 'score.overall': -1 });
driverSchema.index({ assignedVehicleId: 1 }, { sparse: true });
driverSchema.index({ userId: 1 }, { unique: true });

// Methods
driverSchema.methods.addViolation = function(violation) {
  this.violations.push(violation);
  this.penaltyPoints += violation.penaltyPoints || 0;
  // Auto-suspend if too many points
  if (this.penaltyPoints >= 12) {
    this.employment.status = 'suspended';
  }
  // Recalculate safety score
  this.score.safety = Math.max(0, 100 - (this.penaltyPoints * 5));
  this.score.overall = Math.round(
    (this.score.safety + this.score.efficiency + this.score.punctuality + this.score.customerService) / 4
  );
  return this.save();
};

driverSchema.methods.addReward = function(reward) {
  this.rewards.push(reward);
  if (reward.type === 'safe_driving') {
    this.score.safety = Math.min(100, this.score.safety + 5);
  } else if (reward.type === 'fuel_efficiency') {
    this.score.efficiency = Math.min(100, this.score.efficiency + 5);
  }
  this.score.overall = Math.round(
    (this.score.safety + this.score.efficiency + this.score.punctuality + this.score.customerService) / 4
  );
  return this.save();
};

driverSchema.methods.checkLicenseExpiry = function() {
  if (!this.license.expiresAt) return;
  const daysUntilExpiry = (this.license.expiresAt - new Date()) / (24 * 60 * 60 * 1000);
  if (daysUntilExpiry < 0) {
    this.license.status = 'expired';
  } else if (daysUntilExpiry < 30) {
    this.license.status = 'expiring';
  } else {
    this.license.status = 'valid';
  }
};

driverSchema.methods.recordTrip = function(distanceKm, durationHours, fuelL) {
  this.stats.totalTrips += 1;
  this.stats.totalDistanceKm += distanceKm;
  this.stats.totalHours += durationHours;
  this.stats.totalFuelConsumedL += fuelL || 0;
  this.stats.lastTripAt = new Date();
  return this.save();
};

driverSchema.methods.assignVehicle = function(vehicleId, vehicleIdStr, reason = '') {
  if (this.assignedVehicleId) {
    this.assignmentHistory.push({
      vehicleId: this.assignedVehicleId,
      assignedAt: this.assignmentHistory.length ? this.assignmentHistory[this.assignmentHistory.length - 1].assignedAt : new Date(),
      unassignedAt: new Date(),
      reason,
    });
  }
  this.assignedVehicleId = vehicleId;
  return this.save();
};

const Driver = mongoose.model('Driver', driverSchema);
export default Driver;
