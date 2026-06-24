import mongoose from 'mongoose';

/**
 * Fuel Transaction — every fuel purchase / reimbursement.
 * Powers fraud detection, efficiency scoring, cost forecasting.
 */
const fuelTransactionSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

  transactionNumber: { type: String, required: true, unique: true },
  type: {
    type: String,
    enum: ['purchase', 'reimbursement', 'refund', 'adjustment', 'transfer'],
    default: 'purchase',
    required: true,
  },

  // Vehicle
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
  vehicleInfo: {
    vehicleId: String,
    licensePlate: String,
    fuelType: String,
  },

  // Driver
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  driverName: String,

  // Fuel details
  fuel: {
    type: { type: String, enum: ['petrol', 'diesel', 'cng', 'lpg', 'electric', 'hydrogen', 'other'], required: true },
    grade: String, // e.g. 'regular', 'premium', 'diesel_2'
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: ['liters', 'gallons', 'kwh', 'kg'], default: 'liters' },
    pricePerUnit: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD' },
    odometer: { type: Number, min: 0 },
    tankCapacity: Number,
    fillPercentage: Number, // % of tank filled
    isFullTank: { type: Boolean, default: true },
  },

  // Location & time
  station: {
    name: String,
    address: String,
    city: String,
    country: String,
    coordinates: { latitude: Number, longitude: Number },
  },
  timestamp: { type: Date, default: Date.now, required: true, index: true },

  // Payment
  payment: {
    method: { type: String, enum: ['fuel_card', 'credit_card', 'cash', 'mobile_money', 'account', 'reimbursement'], default: 'fuel_card' },
    fuelCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'FuelCard' },
    fuelCardNumber: String, // last 4 digits
    receiptNumber: String,
    authorizationCode: String,
  },

  // Receipt
  receipt: {
    url: String,
    uploadedAt: Date,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ocrExtracted: { type: Boolean, default: false },
    ocrData: mongoose.Schema.Types.Mixed,
  },

  // Efficiency calculation
  efficiency: {
    previousOdometer: Number,
    distanceKm: Number,
    consumptionLPer100km: Number,
    expectedConsumption: Number, // based on vehicle spec
    deviation: Number, // % deviation from expected — fraud signal
    efficiencyScore: Number, // 0-100
  },

  // Fraud detection
  fraud: {
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    flags: [{
      type: { type: String, enum: [
        'duplicate_receipt', 'impossible_distance', 'excessive_consumption',
        'off_hours', 'location_mismatch', 'multiple_transactions_same_time',
        'odometer_rollback', 'price_anomaly', 'excessive_quantity', 'cross_border'
      ] },
      severity: { type: String, enum: ['low', 'medium', 'high'] },
      description: String,
      detectedAt: { type: Date, default: Date.now },
    }],
    isFlagged: { type: Boolean, default: false },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewStatus: { type: String, enum: ['pending', 'confirmed_fraud', 'false_positive', 'under_investigation'], default: 'pending' },
    reviewNotes: String,
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'verified', 'flagged', 'rejected', 'reimbursed'],
    default: 'pending',
    index: true,
  },

  // Reimbursement (for type='reimbursement')
  reimbursement: {
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    paidAt: Date,
    notes: String,
  },

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

fuelTransactionSchema.index({ organizationId: 1, transactionNumber: 1 }, { unique: true });
fuelTransactionSchema.index({ organizationId: 1, vehicleId: 1, timestamp: -1 });
fuelTransactionSchema.index({ organizationId: 1, driverId: 1, timestamp: -1 });
fuelTransactionSchema.index({ organizationId: 1, 'fraud.isFlagged': 1, timestamp: -1 });
fuelTransactionSchema.index({ organizationId: 1, timestamp: -1 });

// Methods
fuelTransactionSchema.methods.calculateEfficiency = function(previousOdometer) {
  if (previousOdometer && this.fuel.odometer) {
    this.efficiency.previousOdometer = previousOdometer;
    this.efficiency.distanceKm = this.fuel.odometer - previousOdometer;
    if (this.efficiency.distanceKm > 0 && this.fuel.isFullTank) {
      this.efficiency.consumptionLPer100km = (this.fuel.quantity / this.efficiency.distanceKm) * 100;
      // Deviation from expected
      if (this.efficiency.expectedConsumption) {
        this.efficiency.deviation = ((this.efficiency.consumptionLPer100km - this.efficiency.expectedConsumption) / this.efficiency.expectedConsumption) * 100;
      }
      // Efficiency score: 100 = at expected, lower = worse
      if (this.efficiency.expectedConsumption && this.efficiency.consumptionLPer100km) {
        const ratio = this.efficiency.expectedConsumption / this.efficiency.consumptionLPer100km;
        this.efficiency.efficiencyScore = Math.max(0, Math.min(100, Math.round(ratio * 100)));
      }
    }
  }
  return this;
};

fuelTransactionSchema.methods.runFraudChecks = function() {
  // 1. Excessive consumption (>30% above expected)
  if (this.efficiency.deviation && this.efficiency.deviation > 30) {
    this.fraud.flags.push({
      type: 'excessive_consumption',
      severity: 'high',
      description: `Consumption ${this.efficiency.deviation.toFixed(1)}% above expected`,
    });
    this.fraud.riskScore += 30;
  }
  // 2. Impossible distance (too much since last fill)
  if (this.efficiency.distanceKm && this.fuel.quantity) {
    const maxPossibleKm = this.fuel.quantity * 20; // assume max 20 km/L
    if (this.efficiency.distanceKm > maxPossibleKm) {
      this.fraud.flags.push({
        type: 'impossible_distance',
        severity: 'high',
        description: `Distance ${this.efficiency.distanceKm}km not possible with ${this.fuel.quantity}L`,
      });
      this.fraud.riskScore += 40;
    }
  }
  // 3. Off-hours (between 11pm and 5am)
  const hour = new Date(this.timestamp).getHours();
  if (hour >= 23 || hour < 5) {
    this.fraud.flags.push({
      type: 'off_hours',
      severity: 'low',
      description: 'Transaction at unusual hour',
    });
    this.fraud.riskScore += 5;
  }
  // 4. Price anomaly (basic check; would be enhanced with historical data)
  if (this.fuel.pricePerUnit && this.fuel.pricePerUnit > 3) { // USD threshold
    this.fraud.flags.push({
      type: 'price_anomaly',
      severity: 'medium',
      description: `Price ${this.fuel.pricePerUnit} per unit unusually high`,
    });
    this.fraud.riskScore += 15;
  }

  if (this.fraud.riskScore >= 30) {
    this.fraud.isFlagged = true;
    this.status = 'flagged';
  }
  return this;
};

const FuelTransaction = mongoose.model('FuelTransaction', fuelTransactionSchema);
export default FuelTransaction;
