import mongoose from 'mongoose';

/**
 * Compliance Record — covers regulatory, safety, inspection, emissions, audit.
 * One record per compliance event per asset/vehicle/driver.
 */
const complianceSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

  recordNumber: { type: String, required: true, unique: true },

  // Category
  category: {
    type: String,
    enum: ['regulatory', 'safety', 'inspection', 'emissions', 'audit', 'permit', 'certification', 'training'],
    required: true,
  },
  subCategory: String,
  type: { type: String, required: true }, // e.g. 'annual_inspection', 'emissions_test', 'driver_background_check'

  // Subject (what the compliance record applies to)
  subjectType: { type: String, enum: ['vehicle', 'driver', 'organization', 'branch', 'equipment'], required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
  subjectName: String,

  // Authority
  authority: {
    name: String, // e.g. 'NTSA', 'EPA', 'DOT'
    jurisdiction: String, // e.g. 'Kenya', 'EU'
    contactEmail: String,
    contactPhone: String,
  },

  // Schedule
  performedAt: Date,
  validFrom: { type: Date, default: Date.now },
  validUntil: { type: Date, index: true },
  nextDueAt: Date,
  nextDueMileage: Number,

  // Result
  result: {
    type: String,
    enum: ['pass', 'fail', 'conditional_pass', 'pending', 'not_applicable', 'waived'],
    default: 'pending',
  },
  score: Number, // if numeric
  maxScore: Number,
  findings: [{
    severity: { type: String, enum: ['info', 'minor', 'major', 'critical'] },
    description: String,
    recommendation: String,
    status: { type: String, enum: ['open', 'in_progress', 'resolved', 'accepted_risk'], default: 'open' },
    resolvedAt: Date,
  }],

  // Documents
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
  }],

  // Status
  status: {
    type: String,
    enum: ['upcoming', 'current', 'expiring', 'expired', 'failed', 'overdue'],
    default: 'current',
    index: true,
  },

  // Cost
  cost: {
    amount: Number,
    currency: { type: String, default: 'USD' },
    invoiceNumber: String,
  },

  // Alerts
  alertSentAt: Date,
  alertType: { type: String, enum: ['expiring_30d', 'expiring_7d', 'expired', 'overdue', 'none'] },

  // Recurrence
  isRecurring: { type: Boolean, default: false },
  recurrenceIntervalDays: Number,

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

complianceSchema.index({ organizationId: 1, recordNumber: 1 }, { unique: true });
complianceSchema.index({ organizationId: 1, subjectType: 1, subjectId: 1 });
complianceSchema.index({ organizationId: 1, category: 1, status: 1 });
complianceSchema.index({ organizationId: 1, validUntil: 1, status: 1 });

complianceSchema.methods.checkExpiry = function() {
  if (!this.validUntil) return this;
  const daysUntilExpiry = (this.validUntil - new Date()) / (24 * 60 * 60 * 1000);
  if (daysUntilExpiry < 0) {
    this.status = 'expired';
    this.alertType = 'expired';
  } else if (daysUntilExpiry < 7) {
    this.status = 'expiring';
    this.alertType = 'expiring_7d';
  } else if (daysUntilExpiry < 30) {
    this.status = 'expiring';
    this.alertType = 'expiring_30d';
  } else {
    this.status = 'current';
    this.alertType = 'none';
  }
  return this;
};

const Compliance = mongoose.model('Compliance', complianceSchema);
export default Compliance;
