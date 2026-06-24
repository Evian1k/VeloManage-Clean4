import mongoose from 'mongoose';

/**
 * Vendor — supplier / contractor / service provider.
 * Used by Procurement, Maintenance, Fuel, Insurance.
 */
const vendorSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

  vendorId: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  legalName: String,
  type: {
    type: String,
    enum: ['parts_supplier', 'service_provider', 'fuel_supplier', 'insurance_provider', 'leasing_company',
           'maintenance_shop', 'dealer', 'consultant', 'contractor', 'other'],
    required: true,
  },
  categories: [String], // what they supply

  // Contact
  contact: {
    primaryName: String,
    primaryEmail: { type: String, lowercase: true, trim: true },
    primaryPhone: String,
    secondaryName: String,
    secondaryEmail: String,
    secondaryPhone: String,
    website: String,
  },

  // Address
  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    coordinates: { latitude: Number, longitude: Number },
  },

  // Business
  taxId: String,
  registrationNumber: String,
  bankAccount: {
    bankName: String,
    accountName: String,
    accountNumber: String, // last 4 only
    iban: String,
    swift: String,
  },

  // Vendor portal access
  portalAccess: {
    enabled: { type: Boolean, default: false },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    invitedAt: Date,
    lastLoginAt: Date,
  },

  // Performance
  performance: {
    rating: { type: Number, default: 0, min: 0, max: 5 }, // 0-5 stars
    totalOrders: { type: Number, default: 0 },
    completedOrders: { type: Number, default: 0 },
    cancelledOrders: { type: Number, default: 0 },
    onTimeDeliveryRate: Number, // %
    qualityRating: Number,
    responseTimeHours: Number,
    disputeRate: Number, // %
    lastEvaluatedAt: Date,
    evaluations: [{
      evaluatedAt: Date,
      evaluatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
      ratings: {
        quality: Number,
        delivery: Number,
        communication: Number,
        pricing: Number,
        overall: Number,
      },
      comments: String,
    }],
  },

  // Compliance
  compliance: {
    insuranceValid: { type: Boolean, default: false },
    insuranceExpiry: Date,
    certifications: [{
      name: String,
      issuedAt: Date,
      expiresAt: Date,
      documentUrl: String,
    }],
    taxCompliant: { type: Boolean, default: false },
    contractSigned: { type: Boolean, default: false },
  },

  // Payment terms
  paymentTerms: {
    netDays: { type: Number, default: 30 },
    discountPct: { type: Number, default: 0 },
    discountDays: Number,
    currency: { type: String, default: 'USD' },
  },

  // Status
  status: {
    type: String,
    enum: ['prospective', 'active', 'preferred', 'suspended', 'blacklisted', 'former'],
    default: 'prospective',
    index: true,
  },
  approvedAt: Date,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  suspendedAt: Date,
  suspendedReason: String,

  // Documents
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
    expiresAt: Date,
  }],

  // Stats
  stats: {
    totalSpend: { type: Number, default: 0 },
    outstandingBalance: { type: Number, default: 0 },
    lastOrderAt: Date,
    averageOrderValue: Number,
  },

  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

vendorSchema.index({ organizationId: 1, vendorId: 1 }, { unique: true });
vendorSchema.index({ organizationId: 1, status: 1, type: 1 });
vendorSchema.index({ organizationId: 1, name: 1 });

vendorSchema.methods.addEvaluation = function(evaluation) {
  this.performance.evaluations.push(evaluation);
  // Recalculate average rating
  const ratings = this.performance.evaluations.map(e => e.ratings.overall);
  if (ratings.length > 0) {
    this.performance.rating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  }
  this.performance.lastEvaluatedAt = new Date();
  return this.save();
};

const Vendor = mongoose.model('Vendor', vendorSchema);
export default Vendor;
