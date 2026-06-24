import mongoose from 'mongoose';

/**
 * Parts inventory — for maintenance management.
 * Tracks stock levels, reorder points, suppliers, valuation.
 */
const partSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

  partNumber: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  description: String,
  category: { type: String, trim: true, index: true }, // e.g. 'brakes', 'engine', 'tires', 'filters'
  brand: String,
  manufacturerPartNumber: String,

  // Compatibility
  compatibleVehicles: [{
    make: String,
    model: String,
    yearFrom: Number,
    yearTo: Number,
  }],
  compatibleVehicleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' }],

  // Inventory
  stock: {
    onHand: { type: Number, default: 0, min: 0 },
    reserved: { type: Number, default: 0, min: 0 }, // allocated to open work orders
    available: { type: Number, default: 0, min: 0 }, // onHand - reserved
    reorderPoint: { type: Number, default: 5 },
    reorderQuantity: { type: Number, default: 20 },
    maxLevel: Number,
    unit: { type: String, default: 'piece' },
  },

  // Location
  location: {
    warehouse: String,
    aisle: String,
    shelf: String,
    bin: String,
  },

  // Costing (FIFO / weighted avg)
  costing: {
    method: { type: String, enum: ['fifo', 'lifo', 'weighted_average', 'standard'], default: 'weighted_average' },
    unitCost: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    lastPurchaseCost: Number,
    standardCost: Number,
    totalValue: { type: Number, default: 0 },
  },

  // Supplier
  primarySupplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  suppliers: [{
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    vendorName: String,
    vendorPartNumber: String,
    leadTimeDays: Number,
    minimumOrderQuantity: Number,
    unitCost: Number,
  }],

  // Lifecycle
  lifecycle: {
    isHazardous: { type: Boolean, default: false },
    isPerishable: { type: Boolean, default: false },
    shelfLifeDays: Number,
    requiresRefrigeration: { type: Boolean, default: false },
    warrantyDays: Number,
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'discontinued', 'out_of_stock', 'backordered', 'obsolete'],
    default: 'active',
    index: true,
  },

  // Stock movements (audit trail)
  movements: [{
    type: { type: String, enum: ['purchase', 'consumption', 'transfer_in', 'transfer_out', 'adjustment', 'return', 'scrap'] },
    quantity: Number, // +ve in, -ve out
    balanceAfter: Number,
    reference: String, // PO number, work order number
    timestamp: { type: Date, default: Date.now },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String,
  }],

  // Barcode / QR
  barcodes: [{ type: String }],
  qrCode: String,

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

partSchema.index({ organizationId: 1, partNumber: 1 }, { unique: true });
partSchema.index({ organizationId: 1, category: 1 });
partSchema.index({ organizationId: 1, status: 1 });
partSchema.index({ organizationId: 1, 'stock.onHand': 1 });

// Methods
partSchema.methods.adjustStock = function(quantity, type, reference, performedBy, notes = '') {
  this.stock.onHand += quantity;
  if (this.stock.onHand < 0) throw new Error('Stock cannot be negative');
  this.stock.available = this.stock.onHand - this.stock.reserved;
  this.stock.totalValue = this.stock.onHand * this.costing.unitCost;
  this.movements.push({ type, quantity, balanceAfter: this.stock.onHand, reference, performedBy, notes });

  // Update status
  if (this.stock.onHand === 0) this.status = 'out_of_stock';
  else if (this.stock.onHand <= this.stock.reorderPoint) this.status = 'backordered';
  else this.status = 'active';

  return this.save();
};

partSchema.methods.reserve = function(quantity) {
  if (this.stock.available < quantity) {
    throw new Error(`Only ${this.stock.available} available, cannot reserve ${quantity}`);
  }
  this.stock.reserved += quantity;
  this.stock.available = this.stock.onHand - this.stock.reserved;
  return this.save();
};

partSchema.methods.releaseReservation = function(quantity) {
  this.stock.reserved = Math.max(0, this.stock.reserved - quantity);
  this.stock.available = this.stock.onHand - this.stock.reserved;
  return this.save();
};

partSchema.methods.needsReorder = function() {
  return this.stock.onHand <= this.stock.reorderPoint;
};

const Part = mongoose.model('Part', partSchema);
export default Part;
