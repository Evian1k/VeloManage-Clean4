import mongoose from 'mongoose';

/**
 * Contract — customer / vendor contract with SLA terms.
 */
const contractSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

  contractNumber: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  type: {
    type: String,
    enum: ['customer_service', 'vendor_supply', 'service_level', 'leasing', 'maintenance', 'consulting', 'partnership', 'nda', 'other'],
    required: true,
  },

  // Parties
  counterpartyType: { type: String, enum: ['customer', 'vendor', 'partner'] },
  counterpartyId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Customer or Vendor
  counterpartyName: String,

  // Terms
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true, index: true },
  autoRenew: { type: Boolean, default: false },
  renewalTermDays: Number,
  noticePeriodDays: { type: Number, default: 30 },

  // Financial
  value: {
    total: Number,
    currency: { type: String, default: 'USD' },
    billingCycle: { type: String, enum: ['one_time', 'monthly', 'quarterly', 'annual', 'milestone'] },
    paymentTerms: String,
  },

  // SLA
  sla: {
    responseTimeHours: Number,
    resolutionTimeHours: Number,
    uptimePct: Number,
    deliveryOnTimePct: Number,
    penalties: String,
    bonuses: String,
    monitoringMethod: String,
  },

  // Scope
  scope: {
    description: String,
    deliverables: [String],
    exclusions: [String],
    serviceLevels: [{
      metric: String,
      target: String,
      measurement: String,
    }],
  },

  // Documents
  documents: [{
    name: String,
    type: { type: String, enum: ['contract', 'amendment', 'annex', 'sla', 'other'] },
    url: String,
    version: String,
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],

  // Status
  status: {
    type: String,
    enum: ['draft', 'pending_signature', 'active', 'expiring', 'expired', 'terminated', 'amended', 'cancelled'],
    default: 'draft',
    index: true,
  },
  signedByUs: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  signedByThem: String,
  signedAt: Date,

  // Amendments
  amendments: [{
    amendmentNumber: Number,
    description: String,
    effectiveDate: Date,
    documentUrl: String,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
  }],

  // Compliance
  compliance: {
    lastReviewedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nextReviewDueAt: Date,
    performance: {
      onTimeDelivery: Number,
      qualityScore: Number,
      lastAssessedAt: Date,
    },
  },

  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

contractSchema.index({ organizationId: 1, contractNumber: 1 }, { unique: true });
contractSchema.index({ organizationId: 1, status: 1, endDate: 1 });
contractSchema.index({ organizationId: 1, counterpartyType: 1, counterpartyId: 1 });

const Contract = mongoose.model('Contract', contractSchema);
export default Contract;
