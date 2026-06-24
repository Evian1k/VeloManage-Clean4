import mongoose from 'mongoose';

/**
 * Finance Transaction — general ledger entry for the fleet.
 * Covers: vehicle costs, fuel, repairs, insurance, leasing, taxes, expenses, revenue.
 * Categorized for financial reporting, budgeting, forecasting.
 */
const financeSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

  transactionNumber: { type: String, required: true, unique: true },
  reference: String, // external invoice / receipt number
  type: {
    type: String,
    enum: ['income', 'expense', 'transfer', 'asset_purchase', 'liability', 'equity', 'adjustment'],
    required: true,
  },
  category: {
    type: String,
    enum: ['vehicle_purchase', 'vehicle_maintenance', 'fuel', 'insurance', 'leasing', 'taxes', 'licensing',
           'driver_salary', 'driver_bonus', 'staff_salary', 'parts', 'tolls', 'parking', 'fines',
           'office_rent', 'utilities', 'telecom', 'software', 'marketing', 'travel', 'training',
           'consulting', 'legal', 'audit', 'depreciation', 'interest', 'foreign_exchange',
           'asset_sale', 'customer_payment', 'refund', 'other_income', 'other_expense'],
    required: true,
  },
  subCategory: String,
  description: { type: String, required: true },

  // Amount
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD', required: true },
  exchangeRate: { type: Number, default: 1 },
  baseCurrencyAmount: Number, // converted to org base currency
  taxAmount: Number,
  taxRate: Number,
  totalAmount: Number, // amount + tax

  // Date
  transactionDate: { type: Date, required: true, index: true },
  dueDate: Date,
  paidDate: Date,

  // Linking
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceWorkOrder' },
  accidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Accident' },
  purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract' },

  // Payment
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'check', 'credit_card', 'mobile_money', 'fuel_card', 'on_account', 'other'],
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'pending',
    index: true,
  },
  paymentTerms: String,

  // Account (for ledger)
  account: {
    debit: String, // account code
    credit: String,
    costCenter: String,
    profitCenter: String,
  },

  // Approval workflow
  approval: {
    required: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    approvalLevel: Number,
    rejectionReason: String,
  },

  // Documents
  documents: [{
    name: String,
    type: { type: String, enum: ['invoice', 'receipt', 'statement', 'contract', 'other'] },
    url: String,
    uploadedAt: { type: Date, default: Date.now },
  }],

  // Budget linkage
  budgetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Budget' },
  isBudgeted: { type: Boolean, default: false },
  budgetVariance: Number, // actual - budgeted

  // Recurrence
  isRecurring: { type: Boolean, default: false },
  recurrenceId: { type: mongoose.Schema.Types.ObjectId }, // links recurring transactions

  // Status
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'posted', 'void', 'archived'],
    default: 'draft',
    index: true,
  },

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

financeSchema.index({ organizationId: 1, transactionNumber: 1 }, { unique: true });
financeSchema.index({ organizationId: 1, transactionDate: -1 });
financeSchema.index({ organizationId: 1, category: 1, transactionDate: -1 });
financeSchema.index({ organizationId: 1, vehicleId: 1, transactionDate: -1 });
financeSchema.index({ organizationId: 1, type: 1, transactionDate: -1 });
financeSchema.index({ organizationId: 1, paymentStatus: 1, dueDate: 1 });

const FinanceTransaction = mongoose.model('FinanceTransaction', financeSchema);
export default FinanceTransaction;
