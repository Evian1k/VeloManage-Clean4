import mongoose from 'mongoose';

/**
 * Fuel Card — issued to drivers/vehicles, integrates with fuel networks.
 * Tracks limits, restrictions, and per-transaction validation.
 */
const fuelCardSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

  cardNumber: { type: String, required: true, unique: true }, // last 4 stored, rest masked
  fullCardNumberHash: { type: String, select: false }, // for duplicate-detection
  displayName: { type: String, default: 'Fleet Fuel Card' },

  provider: {
    type: String,
    enum: ['shell', 'total', 'bp', 'exxon', 'chevron', 'petro', 'wex', 'fleetcor', 'visa', 'mastercard', 'other'],
    required: true,
  },
  providerCardId: String, // ID at provider's system

  // Assignment
  assignedToType: { type: String, enum: ['driver', 'vehicle', 'department', 'unassigned'], default: 'unassigned' },
  assignedDriverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  assignedVehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  assignedAt: Date,
  assignmentHistory: [{
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    assignedAt: Date,
    unassignedAt: Date,
    reason: String,
  }],

  // Limits & restrictions
  limits: {
    dailySpend: Number,
    weeklySpend: Number,
    monthlySpend: Number,
    perTransactionSpend: Number,
    dailyVolumeL: Number,
    monthlyVolumeL: Number,
    currency: { type: String, default: 'USD' },
  },
  restrictions: {
    fuelTypes: [{ type: String, enum: ['petrol', 'diesel', 'cng', 'lpg', 'electric', 'hydrogen'] }],
    allowedStations: [String], // station names or IDs
    allowedCountries: [String],
    allowedDays: [{ type: String, enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }],
    allowedHours: { start: String, end: String }, // '06:00' to '22:00'
    requiresOdometer: { type: Boolean, default: true },
    requiresPin: { type: Boolean, default: true },
    requiresDriverPin: { type: Boolean, default: false },
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'suspended', 'lost', 'stolen', 'expired', 'cancelled'],
    default: 'active',
    index: true,
  },
  pin: { type: String, select: false },
  expiryMonth: { type: String }, // 'MM'
  expiryYear: { type: String }, // 'YY'

  issuedAt: { type: Date, default: Date.now },
  suspendedAt: Date,
  suspendedReason: String,
  cancelledAt: Date,

  // Usage stats (denormalized for quick access)
  stats: {
    totalTransactions: { type: Number, default: 0 },
    totalSpend: { type: Number, default: 0 },
    totalVolumeL: { type: Number, default: 0 },
    lastUsedAt: Date,
    lastUsedLocation: String,
    currentMonthSpend: { type: Number, default: 0 },
    currentMonthVolumeL: { type: Number, default: 0 },
    currentDaySpend: { type: Number, default: 0 },
  },

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

fuelCardSchema.index({ organizationId: 1, cardNumber: 1 }, { unique: true });
fuelCardSchema.index({ organizationId: 1, status: 1 });
fuelCardSchema.index({ organizationId: 1, assignedDriverId: 1 });
fuelCardSchema.index({ organizationId: 1, assignedVehicleId: 1 });

fuelCardSchema.methods.recordTransaction = function(amount, volumeL) {
  this.stats.totalTransactions += 1;
  this.stats.totalSpend += amount;
  this.stats.totalVolumeL += volumeL || 0;
  this.stats.currentMonthSpend += amount;
  this.stats.currentMonthVolumeL += volumeL || 0;
  this.stats.currentDaySpend += amount;
  this.stats.lastUsedAt = new Date();
  return this.save();
};

fuelCardSchema.methods.resetMonthlyStats = function() {
  this.stats.currentMonthSpend = 0;
  this.stats.currentMonthVolumeL = 0;
  return this.save();
};

fuelCardSchema.methods.resetDailyStats = function() {
  this.stats.currentDaySpend = 0;
  return this.save();
};

fuelCardSchema.methods.isWithinLimits = function(amount, volumeL = 0) {
  if (this.limits.dailySpend && this.stats.currentDaySpend + amount > this.limits.dailySpend) {
    return { ok: false, reason: 'Daily spend limit exceeded' };
  }
  if (this.limits.monthlySpend && this.stats.currentMonthSpend + amount > this.limits.monthlySpend) {
    return { ok: false, reason: 'Monthly spend limit exceeded' };
  }
  if (this.limits.perTransactionSpend && amount > this.limits.perTransactionSpend) {
    return { ok: false, reason: 'Per-transaction limit exceeded' };
  }
  if (this.limits.dailyVolumeL && this.stats.currentDaySpend + volumeL > this.limits.dailyVolumeL) {
    return { ok: false, reason: 'Daily volume limit exceeded' };
  }
  return { ok: true };
};

const FuelCard = mongoose.model('FuelCard', fuelCardSchema);
export default FuelCard;
