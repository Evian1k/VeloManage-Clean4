import mongoose from 'mongoose';

/**
 * Accident / Incident — full workflow from report to legal case closure.
 * Covers: reporting, evidence, investigation, insurance claims, liability, legal.
 */

const evidenceSchema = new mongoose.Schema({
  type: { type: String, enum: ['photo', 'video', 'document', 'witness_statement', 'police_report', 'sketch', 'other'] },
  title: String,
  description: String,
  url: String,
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  metadata: mongoose.Schema.Types.Mixed, // e.g. GPS of photo, timestamp
}, { _id: false });

const involvedPartySchema = new mongoose.Schema({
  partyType: { type: String, enum: ['our_vehicle', 'other_vehicle', 'pedestrian', 'property', 'our_driver', 'other_driver', 'third_party'] },
  name: String,
  contactInfo: {
    phone: String,
    email: String,
    address: String,
  },
  vehicleInfo: {
    make: String,
    model: String,
    year: Number,
    licensePlate: String,
    color: String,
  },
  driverInfo: {
    name: String,
    licenseNumber: String,
    licenseExpiry: Date,
  },
  insuranceInfo: {
    provider: String,
    policyNumber: String,
    claimNumber: String,
  },
  liabilityPercentage: Number, // 0-100
  isAtFault: Boolean,
  notes: String,
}, { _id: false });

const injurySchema = new mongoose.Schema({
  personName: String,
  personType: { type: String, enum: ['our_driver', 'our_passenger', 'other_driver', 'other_passenger', 'pedestrian', 'third_party'] },
  injuryType: String,
  severity: { type: String, enum: ['none', 'minor', 'moderate', 'serious', 'critical', 'fatal'] },
  medicalFacility: String,
  hospitalAdmission: { type: Boolean, default: false },
  hospitalizationDays: Number,
  medicalCost: Number,
  currency: { type: String, default: 'USD' },
  reportedAt: Date,
}, { _id: false });

const accidentSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

  accidentNumber: { type: String, required: true, unique: true },

  // Type & severity
  type: {
    type: String,
    enum: ['collision', 'single_vehicle', 'pedestrian', 'rollover', 'fire', 'theft', 'vandalism', 'weather',
           'animal', 'parking_lot', 'hit_and_run', 'cargo_spill', 'other'],
    required: true,
  },
  severity: {
    type: String,
    enum: ['minor', 'moderate', 'serious', 'critical', 'fatal', 'no_damage'],
    required: true,
  },

  // When & where
  occurredAt: { type: Date, required: true, index: true },
  reportedAt: { type: Date, default: Date.now },
  location: {
    address: String,
    city: String,
    state: String,
    country: String,
    coordinates: { latitude: Number, longitude: Number },
    roadType: String, // highway, urban, rural
    weatherConditions: String,
    roadConditions: String,
    lightingConditions: String,
  },

  // Our vehicle & driver
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
  vehicleInfo: { vehicleId: String, licensePlate: String, make: String, model: String },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
  driverName: String,

  // Description
  description: { type: String, required: true },
  sequenceOfEvents: [String],
  contributingFactors: [String],

  // Parties
  involvedParties: [involvedPartySchema],

  // Injuries & fatalities
  injuries: [injurySchema],
  fatalityCount: { type: Number, default: 0 },

  // Damage
  damage: {
    ourVehicle: {
      description: String,
      estimatedCost: Number,
      actualCost: Number,
      currency: String,
      isDrivable: Boolean,
      towed: Boolean,
    },
    otherProperty: [{
      description: String,
      owner: String,
      estimatedCost: Number,
      actualCost: Number,
    }],
    cargoDamage: {
      description: String,
      estimatedCost: Number,
    },
  },

  // Evidence
  evidence: [evidenceSchema],

  // Police / authorities
  policeReport: {
    filed: { type: Boolean, default: false },
    reportNumber: String,
    filingOfficer: String,
    officerBadge: String,
    station: String,
    filedAt: Date,
    documentUrl: String,
  },

  // Insurance claim
  insurance: {
    claimFiled: { type: Boolean, default: false },
    claimNumber: String,
    provider: String,
    adjuster: {
      name: String,
      phone: String,
      email: String,
    },
    claimAmount: Number,
    approvedAmount: Number,
    deductible: Number,
    status: { type: String, enum: ['not_filed', 'filed', 'under_review', 'approved', 'denied', 'partial', 'settled', 'litigation'], default: 'not_filed' },
    filedAt: Date,
    resolvedAt: Date,
    notes: String,
  },

  // Investigation
  investigation: {
    investigatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    investigatorName: String,
    startedAt: Date,
    completedAt: Date,
    findings: String,
    rootCause: String,
    recommendations: String,
    preventability: { type: String, enum: ['preventable', 'non_preventable', 'undetermined'] },
    documents: [{ name: String, url: String }],
  },

  // Legal
  legal: {
    caseOpened: { type: Boolean, default: false },
    caseNumber: String,
    court: String,
    plaintiff: String,
    defendant: String,
    claimAmount: Number,
    attorney: { name: String, firm: String, phone: String, email: String },
    nextHearingDate: Date,
    status: { type: String, enum: ['none', 'filed', 'pending', 'in_progress', 'settled', 'dismissed', 'appealed'], default: 'none' },
    notes: String,
  },

  // Liability
  liability: {
    ourPercentage: Number,
    otherPartyPercentage: Number,
    shared: Boolean,
    determination: { type: String, enum: ['undetermined', 'our_fault', 'other_fault', 'shared', 'no_fault'] },
    determinedBy: String,
    determinedAt: Date,
  },

  // Status
  status: {
    type: String,
    enum: ['reported', 'investigating', 'under_review', 'resolved', 'closed', 'litigation', 'denied'],
    default: 'reported',
    index: true,
  },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String,
  }],

  // Financial impact
  financialImpact: {
    repairCost: Number,
    medicalCost: Number,
    legalCost: Number,
    settlementCost: Number,
    lostRevenue: Number,
    deductible: Number,
    insuranceRecovery: Number,
    totalNetCost: Number,
    currency: { type: String, default: 'USD' },
  },

  // Lessons learned
  lessonsLearned: String,
  preventiveActions: [{
    action: String,
    dueDate: Date,
    completedAt: Date,
    responsible: String,
  }],

  // Audit
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

accidentSchema.index({ organizationId: 1, accidentNumber: 1 }, { unique: true });
accidentSchema.index({ organizationId: 1, status: 1, occurredAt: -1 });
accidentSchema.index({ organizationId: 1, vehicleId: 1, occurredAt: -1 });
accidentSchema.index({ organizationId: 1, driverId: 1, occurredAt: -1 });
accidentSchema.index({ organizationId: 1, severity: 1, occurredAt: -1 });

accidentSchema.methods.calculateFinancialImpact = function() {
  const f = this.financialImpact;
  f.totalNetCost = (f.repairCost || 0) + (f.medicalCost || 0) + (f.legalCost || 0) +
                   (f.settlementCost || 0) + (f.lostRevenue || 0) + (f.deductible || 0) -
                   (f.insuranceRecovery || 0);
  return this;
};

accidentSchema.methods.changeStatus = function(newStatus, userId, notes = '') {
  this.status = newStatus;
  this.statusHistory.push({ status: newStatus, changedBy: userId, notes });
  return this.save();
};

const Accident = mongoose.model('Accident', accidentSchema);
export default Accident;
