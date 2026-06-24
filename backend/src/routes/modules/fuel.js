import express from 'express';
import FuelTransaction from '../../models/FuelTransaction.js';
import FuelCard from '../../models/FuelCard.js';
import { createCrudRouter } from '../crudFactory.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantFilter } from '../../middleware/tenant.js';

const router = createCrudRouter(FuelTransaction, {
  permissions: { read: 'fuel:read', write: 'fuel:write', delete: 'fuel:delete' },
  category: 'fuel',
  searchableFields: ['transactionNumber', 'vehicleInfo.licensePlate', 'driverName'],
  defaultSort: { timestamp: -1 },
  population: [
    { path: 'vehicleId', select: 'vehicleId licensePlate make model' },
    { path: 'driverId', select: 'fullName email' },
  ],
});

// Record fuel purchase with fraud detection
router.post('/', requirePermission('fuel:write'), async (req, res, next) => {
  try {
    // Get previous fuel transaction for odometer-based efficiency
    const previous = await FuelTransaction.findOne({
      ...tenantFilter(req),
      vehicleId: req.body.vehicleId,
      timestamp: { $lt: new Date() },
    }).sort({ timestamp: -1 });

    const txn = new FuelTransaction({
      ...req.body,
      organizationId: req.tenantId,
      createdBy: req.user._id,
    });
    txn.transactionNumber = txn.transactionNumber || `FT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Calculate efficiency if previous transaction exists
    if (previous && previous.fuel.odometer) {
      txn.calculateEfficiency(previous.fuel.odometer);
    }

    // Run fraud checks
    txn.runFraudChecks();
    await txn.save();

    // Update fuel card stats
    if (txn.payment.fuelCardId) {
      const card = await FuelCard.findOne({ _id: txn.payment.fuelCardId, ...tenantFilter(req) });
      if (card) {
        const limitCheck = card.isWithinLimits(txn.fuel.totalAmount, txn.fuel.quantity);
        if (!limitCheck.ok) {
          txn.status = 'flagged';
          txn.fraud.flags.push({
            type: 'excessive_quantity',
            severity: 'medium',
            description: limitCheck.reason,
          });
          await txn.save();
        }
        await card.recordTransaction(txn.fuel.totalAmount, txn.fuel.quantity);
      }
    }

    res.status(201).json({ success: true, data: txn });
  } catch (err) { next(err); }
});

// Flagged transactions (for fraud review)
router.get('/flagged/all', requirePermission('fuel:read'), async (req, res, next) => {
  try {
    const txns = await FuelTransaction.find({
      ...tenantFilter(req),
      'fraud.isFlagged': true,
      'fraud.reviewStatus': { $in: ['pending', 'under_investigation'] },
    }).sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, data: txns, count: txns.length });
  } catch (err) { next(err); }
});

// Review flagged transaction
router.post('/:id/review', requirePermission('fuel:read'), async (req, res, next) => {
  try {
    const { status, notes } = req.body; // 'confirmed_fraud' | 'false_positive'
    const txn = await FuelTransaction.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!txn) return res.status(404).json({ success: false, message: 'Transaction not found' });
    txn.fraud.reviewStatus = status;
    txn.fraud.reviewNotes = notes;
    txn.fraud.reviewedBy = req.user._id;
    txn.fraud.reviewedAt = new Date();
    if (status === 'false_positive') {
      txn.status = 'verified';
      txn.fraud.isFlagged = false;
    } else if (status === 'confirmed_fraud') {
      txn.status = 'rejected';
    }
    await txn.save();
    res.json({ success: true, data: txn });
  } catch (err) { next(err); }
});

// Consumption analytics
router.get('/analytics/consumption', requirePermission('fuel:read'), async (req, res, next) => {
  try {
    const period = parseInt(req.query.period) || 30; // days
    const since = new Date();
    since.setDate(since.getDate() - period);

    const stats = await FuelTransaction.aggregate([
      { $match: { ...tenantFilter(req) && { organizationId: req.tenantId }, timestamp: { $gte: since } } },
      {
        $group: {
          _id: { vehicleId: '$vehicleId', fuelType: '$fuel.type' },
          totalQuantity: { $sum: '$fuel.quantity' },
          totalCost: { $sum: '$fuel.totalAmount' },
          transactionCount: { $sum: 1 },
          avgEfficiency: { $avg: '$efficiency.consumptionLPer100km' },
          flaggedCount: { $sum: { $cond: ['$fraud.isFlagged', 1, 0] } },
        },
      },
      { $sort: { totalCost: -1 } },
    ]);
    res.json({ success: true, data: stats, period });
  } catch (err) { next(err); }
});

// ─── Fuel Cards ───────────────────────────────────────────────────────────
router.use('/cards', createCrudRouter(FuelCard, {
  permissions: { read: 'fuel:read', write: 'fuel:write', delete: 'fuel:delete' },
  category: 'fuel',
  searchableFields: ['cardNumber', 'displayName', 'provider'],
}));

export default router;
