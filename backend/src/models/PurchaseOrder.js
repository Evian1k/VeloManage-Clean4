import mongoose from 'mongoose';

/**
 * Purchase Order — procurement document.
 * Workflow: draft → pending_approval → approved → sent → received → invoiced → closed
 */
const poLineItemSchema = new mongoose.Schema({
  lineNumber: Number,
  description: { type: String, required: true },
  partId: { type: mongoose.Schema.Types.ObjectId, ref: 'Part' },
  partNumber: String,
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, default: 'piece' },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  taxRate: Number,
  taxAmount: Number,
  receivedQuantity: { type: Number, default: 0 },
  acceptedQuantity: { type: Number, default: 0 },
  rejectedQuantity: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'partial', 'received', 'rejected', 'cancelled'],
    default: 'pending',
  },
  expectedDeliveryDate: Date,
  notes: String,
}, { _id: false });

const purchaseOrderSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

  poNumber: { type: String, required: true, unique: true },
  title: String,
  description: String,

  // Vendor
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  vendorName: String,
  vendorContact: String,

  // Requester
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestedAt: { type: Date, default: Date.now },
  department: String,
  justification: String, // business case

  // Lines
  lineItems: [poLineItemSchema],

  // Totals
  totals: {
    subtotal: Number,
    taxTotal: Number,
    shippingCost: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    grandTotal: Number,
    currency: { type: String, default: 'USD' },
  },

  // Delivery
  deliveryAddress: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
  },
  expectedDeliveryDate: Date,
  actualDeliveryDate: Date,

  // Approval workflow
  approval: {
    currentLevel: { type: Number, default: 0 },
    required: { type: Boolean, default: true },
    levels: [{
      level: Number,
      approverRole: String,
      approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      approvedAt: Date,
      comments: String,
    }],
    approvedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,
  },

  // Status
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'rejected', 'sent', 'partially_received', 'received', 'invoiced', 'closed', 'cancelled'],
    default: 'draft',
    index: true,
  },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String,
  }],

  // Linked records
  financeTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinanceTransaction' },
  contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract' },

  // Documents
  documents: [{
    name: String,
    type: { type: String, enum: ['po', 'invoice', 'delivery_note', 'quality_report', 'other'] },
    url: String,
    uploadedAt: { type: Date, default: Date.now },
  }],

  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

purchaseOrderSchema.index({ organizationId: 1, poNumber: 1 }, { unique: true });
purchaseOrderSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
purchaseOrderSchema.index({ organizationId: 1, vendorId: 1, createdAt: -1 });
purchaseOrderSchema.index({ organizationId: 1, requestedBy: 1 });

purchaseOrderSchema.methods.calculateTotals = function() {
  let subtotal = 0, taxTotal = 0;
  this.lineItems.forEach((item) => {
    item.totalPrice = item.quantity * item.unitPrice;
    item.taxAmount = item.totalPrice * (item.taxRate || 0) / 100;
    subtotal += item.totalPrice;
    taxTotal += item.taxAmount;
  });
  this.totals.subtotal = subtotal;
  this.totals.taxTotal = taxTotal;
  this.totals.grandTotal = subtotal + taxTotal + (this.totals.shippingCost || 0) - (this.totals.discount || 0);
  return this;
};

purchaseOrderSchema.methods.approve = function(userId, comments = '') {
  if (!this.approval.levels || this.approval.levels.length === 0) {
    this.status = 'approved';
    this.approval.approvedAt = new Date();
    return this.save();
  }
  const currentLevel = this.approval.levels.find(l => l.status === 'pending');
  if (currentLevel) {
    currentLevel.status = 'approved';
    currentLevel.approverId = userId;
    currentLevel.approvedAt = new Date();
    currentLevel.comments = comments;
    this.approval.currentLevel += 1;
    if (this.approval.currentLevel >= this.approval.levels.length) {
      this.status = 'approved';
      this.approval.approvedAt = new Date();
    }
  }
  return this.save();
};

purchaseOrderSchema.methods.reject = function(userId, reason) {
  this.status = 'rejected';
  this.approval.rejectedAt = new Date();
  this.approval.rejectionReason = reason;
  return this.save();
};

purchaseOrderSchema.methods.receiveItem = function(lineNumber, quantityReceived, quantityRejected = 0) {
  const item = this.lineItems.find(li => li.lineNumber === lineNumber);
  if (!item) throw new Error('Line item not found');
  item.receivedQuantity += quantityReceived;
  item.acceptedQuantity += quantityReceived - quantityRejected;
  item.rejectedQuantity += quantityRejected;
  if (item.acceptedQuantity >= item.quantity) {
    item.status = 'received';
  } else if (item.acceptedQuantity > 0) {
    item.status = 'partial';
  }
  // Update PO status
  const allReceived = this.lineItems.every(li => li.status === 'received' || li.status === 'rejected' || li.status === 'cancelled');
  const anyReceived = this.lineItems.some(li => li.acceptedQuantity > 0);
  if (allReceived) {
    this.status = 'received';
    this.actualDeliveryDate = new Date();
  } else if (anyReceived) {
    this.status = 'partially_received';
  }
  return this.save();
};

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
export default PurchaseOrder;
