import mongoose from 'mongoose';

/**
 * Customer — B2B customer (logistics, transport, delivery companies etc.)
 * Linked to Contracts, SLAs, Support tickets, Trips.
 */
const customerSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

  customerId: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  legalName: String,
  type: {
    type: String,
    enum: ['enterprise', 'smb', 'government', 'nonprofit', 'individual', 'reseller'],
    default: 'enterprise',
  },
  industry: String,

  // Contact
  contact: {
    primaryName: String,
    primaryTitle: String,
    primaryEmail: { type: String, lowercase: true, trim: true, required: true },
    primaryPhone: String,
    secondaryName: String,
    secondaryEmail: String,
    secondaryPhone: String,
  },

  // Address
  billingAddress: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
  },
  shippingAddress: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    coordinates: { latitude: Number, longitude: Number },
  },

  // Financial
  taxId: String,
  paymentTerms: {
    netDays: { type: Number, default: 30 },
    currency: { type: String, default: 'USD' },
    creditLimit: Number,
    creditBalance: Number,
  },

  // Account
  accountManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acquisitionDate: { type: Date, default: Date.now },
  acquisitionChannel: String,

  // Contracts & SLA
  contractIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contract' }],
  activeContractId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract' },
  sla: {
    responseTimeHours: Number,
    resolutionTimeHours: Number,
    uptimePct: Number,
    deliveryOnTimePct: Number,
  },

  // Stats
  stats: {
    totalRevenue: { type: Number, default: 0 },
    outstandingBalance: { type: Number, default: 0 },
    totalTrips: { type: Number, default: 0 },
    totalContracts: { type: Number, default: 0 },
    openTickets: { type: Number, default: 0 },
    satisfactionScore: { type: Number, min: 0, max: 5 },
    lastOrderAt: Date,
    lastInteractionAt: Date,
  },

  // Status
  status: {
    type: String,
    enum: ['lead', 'prospect', 'active', 'dormant', 'churned', 'blacklisted'],
    default: 'lead',
    index: true,
  },

  // Support
  supportTier: {
    type: String,
    enum: ['free', 'basic', 'premium', 'enterprise', 'government'],
    default: 'basic',
  },

  // Notes & tags
  notes: String,
  tags: [String],

  // Documents
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
  }],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

customerSchema.index({ organizationId: 1, customerId: 1 }, { unique: true });
customerSchema.index({ organizationId: 1, status: 1, type: 1 });
customerSchema.index({ organizationId: 1, accountManager: 1 });
customerSchema.index({ organizationId: 1, name: 1 });

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;
