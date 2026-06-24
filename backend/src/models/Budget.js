import mongoose from 'mongoose';

/**
 * Budget — financial planning & variance tracking.
 */
const budgetSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  departmentId: String,

  name: { type: String, required: true },
  description: String,
  fiscalYear: { type: Number, required: true },
  fiscalPeriod: {
    type: String,
    enum: ['annual', 'q1', 'q2', 'q3', 'q4', 'h1', 'h2', 'monthly'],
    required: true,
  },

  // Categories
  categories: [{
    category: { type: String, required: true }, // matches FinanceTransaction.category
    subCategory: String,
    budgeted: { type: Number, default: 0 },
    actual: { type: Number, default: 0 },
    variance: Number, // actual - budgeted
    variancePct: Number,
    committed: { type: Number, default: 0 }, // open POs
    available: Number, // budgeted - actual - committed
    notes: String,
  }],

  // Totals
  totals: {
    budgeted: Number,
    actual: Number,
    variance: Number,
    variancePct: Number,
    currency: { type: String, default: 'USD' },
  },

  // Revenue budget (separate from expenses)
  revenue: [{
    source: String,
    budgeted: Number,
    actual: Number,
    variance: Number,
  }],

  // Status
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'active', 'closed', 'archived'],
    default: 'draft',
    index: true,
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,

  // Versioning
  version: { type: Number, default: 1 },
  previousVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Budget' },

  // Forecasting
  forecast: {
    method: { type: String, enum: ['linear', 'moving_average', 'seasonal', 'manual'], default: 'linear' },
    yearEndProjection: Number,
    confidenceLevel: Number,
    assumptions: [String],
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

budgetSchema.index({ organizationId: 1, fiscalYear: 1, fiscalPeriod: 1 });
budgetSchema.index({ organizationId: 1, status: 1 });

budgetSchema.methods.calculateVariances = function() {
  this.categories.forEach(cat => {
    cat.variance = cat.actual - cat.budgeted;
    cat.variancePct = cat.budgeted > 0 ? (cat.variance / cat.budgeted) * 100 : 0;
    cat.available = cat.budgeted - cat.actual - cat.committed;
  });
  this.totals.budgeted = this.categories.reduce((s, c) => s + c.budgeted, 0);
  this.totals.actual = this.categories.reduce((s, c) => s + c.actual, 0);
  this.totals.variance = this.totals.actual - this.totals.budgeted;
  this.totals.variancePct = this.totals.budgeted > 0 ? (this.totals.variance / this.totals.budgeted) * 100 : 0;
  return this;
};

const Budget = mongoose.model('Budget', budgetSchema);
export default Budget;
