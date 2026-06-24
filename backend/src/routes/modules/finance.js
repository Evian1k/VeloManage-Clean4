import express from 'express';
import FinanceTransaction from '../../models/FinanceTransaction.js';
import Budget from '../../models/Budget.js';
import { createCrudRouter } from '../crudFactory.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantFilter } from '../../middleware/tenant.js';

const router = createCrudRouter(FinanceTransaction, {
  permissions: { read: 'finance:read', write: 'finance:write', delete: 'finance:delete' },
  category: 'finance',
  searchableFields: ['transactionNumber', 'reference', 'description', 'category'],
  defaultSort: { transactionDate: -1 },
  population: [
    { path: 'vehicleId', select: 'vehicleId licensePlate' },
    { path: 'vendorId', select: 'name' },
    { path: 'customerId', select: 'name' },
  ],
});

// Approve transaction
router.post('/:id/approve', requirePermission('finance:approve'), async (req, res, next) => {
  try {
    const txn = await FinanceTransaction.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!txn) return res.status(404).json({ success: false, message: 'Transaction not found' });
    txn.approval.approvedBy = req.user._id;
    txn.approval.approvedAt = new Date();
    txn.status = 'posted';
    await txn.save();
    res.json({ success: true, data: txn, message: 'Transaction approved & posted' });
  } catch (err) { next(err); }
});

// Financial dashboard — totals by category for a period
router.get('/dashboard/summary', requirePermission('finance:read'), async (req, res, next) => {
  try {
    const period = parseInt(req.query.period) || 30;
    const since = new Date();
    since.setDate(since.getDate() - period);
    const [byCategory, byType, totals] = await Promise.all([
      FinanceTransaction.aggregate([
        { $match: { organizationId: req.tenantId, transactionDate: { $gte: since } } },
        { $group: { _id: { category: '$category', type: '$type' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      FinanceTransaction.aggregate([
        { $match: { organizationId: req.tenantId, transactionDate: { $gte: since } } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      FinanceTransaction.aggregate([
        { $match: { organizationId: req.tenantId, transactionDate: { $gte: since } } },
        {
          $group: {
            _id: null,
            income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
            expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);
    const t = totals[0] || { income: 0, expense: 0, count: 0 };
    res.json({
      success: true,
      data: {
        period,
        totals: { ...t, net: (t.income || 0) - (t.expense || 0) },
        byCategory,
        byType,
      },
    });
  } catch (err) { next(err); }
});

// Outstanding payments
router.get('/outstanding/all', requirePermission('finance:read'), async (req, res, next) => {
  try {
    const txns = await FinanceTransaction.find({
      ...tenantFilter(req),
      paymentStatus: { $in: ['pending', 'partial', 'overdue'] },
      type: 'expense',
    }).sort({ dueDate: 1 }).limit(100);
    const total = txns.reduce((sum, t) => sum + t.amount, 0);
    res.json({ success: true, data: txns, total, count: txns.length });
  } catch (err) { next(err); }
});

// ─── Budgets ───────────────────────────────────────────────────────────────
router.use('/budgets', createCrudRouter(Budget, {
  permissions: { read: 'finance:read', write: 'finance:write', delete: 'finance:delete' },
  category: 'finance',
  searchableFields: ['name', 'description', 'fiscalPeriod'],
  defaultSort: { fiscalYear: -1 },
}));

export default router;
