import express from 'express';
import Customer from '../../models/Customer.js';
import Contract from '../../models/Contract.js';
import { createCrudRouter } from '../crudFactory.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantFilter } from '../../middleware/tenant.js';

const router = createCrudRouter(Customer, {
  permissions: { read: 'crm:read', write: 'crm:write', delete: 'crm:delete' },
  category: 'crm',
  searchableFields: ['customerId', 'name', 'legalName', 'contact.primaryEmail', 'contact.primaryPhone'],
  defaultSort: { createdAt: -1 },
  population: [{ path: 'accountManager', select: 'name email' }],
});

// ─── Contracts ─────────────────────────────────────────────────────────────
const contractRouter = createCrudRouter(Contract, {
  permissions: { read: 'crm:read', write: 'crm:write', delete: 'crm:delete' },
  category: 'crm',
  searchableFields: ['contractNumber', 'title', 'counterpartyName'],
  defaultSort: { endDate: 1 },
});

// Expiring contracts
contractRouter.get('/expiring/all', requirePermission('crm:read'), async (req, res, next) => {
  try {
    const daysAhead = parseInt(req.query.days) || 60;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);
    const contracts = await Contract.find({
      ...tenantFilter(req),
      endDate: { $lte: cutoff, $gte: new Date() },
      status: 'active',
    }).sort({ endDate: 1 });
    res.json({ success: true, data: contracts, count: contracts.length });
  } catch (err) { next(err); }
});

router.use('/contracts', contractRouter);

export default router;
