import mongoose from 'mongoose';

/**
 * Maintenance Work Order — full preventive / predictive / corrective maintenance lifecycle.
 *
 * Covers:
 *   - Scheduled (preventive) — auto-generated from service schedule
 *   - Predictive — AI-flagged from telematics anomalies (integration point)
 *   - Corrective — from breakdown or inspection failure
 *
 * Workflow:
 *   created → approved → assigned → in_progress → completed → closed
 */

const partUsageSchema = new mongoose.Schema({
  partId: { type: mongoose.Schema.Types.ObjectId, ref: 'Part' },
  partName: String,
  partNumber: String,
  quantity: { type: Number, required: true, min: 1 },
  unitCost: Number,
  totalCost: Number,
  currency: { type: String, default: 'USD' },
}, { _id: false });

const laborSchema = new mongoose.Schema({
  mechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  mechanicName: String,
  hours: { type: Number, required: true },
  hourlyRate: Number,
  totalCost: Number,
  description: String,
}, { _id: false });

const workOrderSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

  workOrderNumber: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: String,

  // Type
  type: {
    type: String,
    enum: ['preventive', 'predictive', 'corrective', 'inspection', 'recall', 'modification', 'emergency'],
    required: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical', 'emergency'],
    default: 'medium',
  },

  // Vehicle
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
  vehicleInfo: {
    vehicleId: String,
    licensePlate: String,
    make: String,
    model: String,
    currentMileage: Number,
  },

  // Driver who reported
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reportedAt: { type: Date, default: Date.now },
  reportedIssue: String,

  // Schedule
  scheduledAt: Date,
  startedAt: Date,
  completedAt: Date,
  closedAt: Date,
  estimatedDurationHours: Number,
  actualDurationHours: Number,

  // Assignment
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // mechanic
  assignedMechanicName: String,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,

  // Status
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'assigned', 'in_progress', 'on_hold',
           'completed', 'verified', 'closed', 'cancelled', 'rejected'],
    default: 'draft',
    index: true,
  },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String,
  }],

  // Work performed
  tasks: [{
    description: String,
    completed: { type: Boolean, default: false },
    completedAt: Date,
    mechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  diagnosis: String,
  workPerformed: String,
  recommendations: String,

  // Costs
  parts: [partUsageSchema],
  labor: [laborSchema],
  additionalCosts: [{
    description: String,
    amount: Number,
    currency: { type: String, default: 'USD' },
  }],
  totalCost: {
    parts: { type: Number, default: 0 },
    labor: { type: Number, default: 0 },
    additional: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
  },

  // Downtime tracking
  downtime: {
    startedAt: Date,
    endedAt: Date,
    totalHours: { type: Number, default: 0 },
    revenueLost: Number,
  },

  // Documents
  documents: [{
    name: String,
    type: { type: String, enum: ['photo', 'invoice', 'report', 'warranty', 'other'] },
    url: String,
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],

  // Warranty
  warranty: {
    covered: { type: Boolean, default: false },
    provider: String,
    claimNumber: String,
    coveredAmount: Number,
  },

  // Recurring / scheduled
  isRecurring: { type: Boolean, default: false },
  recurrence: {
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'mileage'] },
    interval: Number,
    nextDueAt: Date,
    nextDueMileage: Number,
  },

  // Quality / verification
  verification: {
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date,
    result: { type: String, enum: ['pass', 'fail', 'pending'] },
    notes: String,
  },

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Indexes
workOrderSchema.index({ organizationId: 1, workOrderNumber: 1 }, { unique: true });
workOrderSchema.index({ organizationId: 1, status: 1, priority: 1 });
workOrderSchema.index({ organizationId: 1, vehicleId: 1, createdAt: -1 });
workOrderSchema.index({ organizationId: 1, scheduledAt: 1 });
workOrderSchema.index({ organizationId: 1, assignedTo: 1, status: 1 });
workOrderSchema.index({ organizationId: 1, type: 1 });

// Methods
workOrderSchema.methods.calculateTotal = function() {
  this.totalCost.parts = this.parts.reduce((sum, p) => sum + (p.totalCost || 0), 0);
  this.totalCost.labor = this.labor.reduce((sum, l) => sum + (l.totalCost || 0), 0);
  this.totalCost.additional = this.additionalCosts.reduce((sum, a) => sum + (a.amount || 0), 0);
  this.totalCost.total = this.totalCost.parts + this.totalCost.labor + this.totalCost.additional;
  return this;
};

workOrderSchema.methods.changeStatus = function(newStatus, userId, notes = '') {
  this.status = newStatus;
  this.statusHistory.push({ status: newStatus, changedBy: userId, notes });
  if (newStatus === 'in_progress' && !this.startedAt) this.startedAt = new Date();
  if (newStatus === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
    if (this.startedAt) {
      this.actualDurationHours = (this.completedAt - this.startedAt) / (60 * 60 * 1000);
    }
    if (this.downtime.startedAt && !this.downtime.endedAt) {
      this.downtime.endedAt = new Date();
      this.downtime.totalHours = (this.downtime.endedAt - this.downtime.startedAt) / (60 * 60 * 1000);
    }
  }
  if (newStatus === 'closed' && !this.closedAt) this.closedAt = new Date();
  return this.save();
};

workOrderSchema.methods.approve = function(userId, notes = '') {
  this.approvedBy = userId;
  this.approvedAt = new Date();
  return this.changeStatus('approved', userId, notes);
};

const MaintenanceWorkOrder = mongoose.model('MaintenanceWorkOrder', workOrderSchema);
export default MaintenanceWorkOrder;
