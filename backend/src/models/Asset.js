import mongoose from 'mongoose';

/**
 * Asset — non-vehicle asset (equipment, IT, furniture, etc.).
 * Tracks allocation, depreciation, audits.
 */
const assetSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

  assetId: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true },
  description: String,
  category: {
    type: String,
    enum: ['it_equipment', 'office_equipment', 'machinery', 'tools', 'furniture', 'building', 'land',
           'intangible', 'software', 'vehicle_accessory', 'safety_equipment', 'other'],
    required: true,
  },
  subCategory: String,
  brand: String,
  model: String,
  serialNumber: String,

  // Assignment
  assignedTo: {
    type: { type: String, enum: ['user', 'branch', 'vehicle', 'department', 'unassigned'], default: 'unassigned' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    departmentId: String,
  },
  assignmentHistory: [{
    assignedTo: mongoose.Schema.Types.Mixed,
    assignedAt: Date,
    unassignedAt: Date,
    reason: String,
    conditionAtReturn: String,
  }],

  // Location
  location: {
    address: String,
    coordinates: { latitude: Number, longitude: Number },
    room: String,
  },

  // Financial
  acquisition: {
    date: Date,
    method: { type: String, enum: ['purchase', 'lease', 'rental', 'donated', 'internal_transfer'] },
    cost: Number,
    currency: { type: String, default: 'USD' },
    vendor: String,
    invoiceNumber: String,
  },
  depreciation: {
    method: { type: String, enum: ['straight_line', 'declining_balance', 'none'], default: 'straight_line' },
    usefulLifeYears: Number,
    salvageValue: { type: Number, default: 0 },
    annualDepreciation: Number,
    currentValue: Number,
    accumulatedDepreciation: Number,
    lastCalculatedAt: Date,
  },

  // Status
  status: {
    type: String,
    enum: ['in_use', 'in_storage', 'in_repair', 'lost', 'stolen', 'retired', 'disposed', 'reserved'],
    default: 'in_storage',
    index: true,
  },
  condition: {
    type: String,
    enum: ['new', 'excellent', 'good', 'fair', 'poor', 'damaged', 'unusable'],
    default: 'new',
  },

  // Maintenance / warranty
  warranty: {
    provider: String,
    startDate: Date,
    endDate: Date,
    terms: String,
  },
  lastMaintenanceAt: Date,
  nextMaintenanceDueAt: Date,

  // Audit trail (literally — for asset audits)
  lastAuditAt: Date,
  lastAuditBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastAuditResult: { type: String, enum: ['found', 'missing', 'damaged', 'wrong_location'] },
  auditHistory: [{
    auditedAt: Date,
    auditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    result: String,
    notes: String,
  }],

  // Documents
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
  }],

  // Tracking
  barcodes: [String],
  qrCode: String,
  rfidTag: String,

  // Custom fields
  customFields: { type: Map, of: mongoose.Schema.Types.Mixed },

  isActive: { type: Boolean, default: true },
  retiredAt: Date,
  disposedAt: Date,

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

assetSchema.index({ organizationId: 1, assetId: 1 }, { unique: true });
assetSchema.index({ organizationId: 1, category: 1, status: 1 });
assetSchema.index({ organizationId: 1, 'assignedTo.userId': 1 }, { sparse: true });
assetSchema.index({ organizationId: 1, 'assignedTo.branchId': 1 }, { sparse: true });

assetSchema.methods.calculateDepreciation = function() {
  if (!this.acquisition?.cost || !this.depreciation?.usefulLifeYears) return this;
  const cost = this.acquisition.cost;
  const yearsElapsed = this.acquisition.date
    ? Math.min(this.depreciation.usefulLifeYears, (Date.now() - this.acquisition.date.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 0;
  if (this.depreciation.method === 'straight_line') {
    const annual = (cost - (this.depreciation.salvageValue || 0)) / this.depreciation.usefulLifeYears;
    this.depreciation.annualDepreciation = annual;
    this.depreciation.accumulatedDepreciation = annual * yearsElapsed;
    this.depreciation.currentValue = Math.max(this.depreciation.salvageValue || 0, cost - this.depreciation.accumulatedDepreciation);
    this.depreciation.lastCalculatedAt = new Date();
  }
  return this;
};

const Asset = mongoose.model('Asset', assetSchema);
export default Asset;
