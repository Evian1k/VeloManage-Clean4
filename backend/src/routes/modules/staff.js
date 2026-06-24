import express from 'express';
import Staff from '../../models/Staff.js';
import { createCrudRouter } from '../crudFactory.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantFilter } from '../../middleware/tenant.js';

const router = createCrudRouter(Staff, {
  permissions: { read: 'hr:read', write: 'hr:write', delete: 'hr:delete' },
  category: 'hr',
  searchableFields: ['employeeId', 'fullName', 'email', 'phone', 'employment.position', 'employment.department'],
  defaultSort: { createdAt: -1 },
  population: [{ path: 'userId', select: 'name email role isActive' }],
});

// Apply for leave
router.post('/:id/leave', requirePermission('hr:write'), async (req, res, next) => {
  try {
    const staff = await Staff.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });
    await staff.applyLeave(req.body);
    res.json({ success: true, data: staff, message: 'Leave request submitted' });
  } catch (err) { next(err); }
});

// Approve leave
router.post('/:id/leave/:requestId/approve', requirePermission('hr:write'), async (req, res, next) => {
  try {
    const staff = await Staff.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });
    await staff.approveLeave(req.params.requestId, req.user._id, req.body.notes);
    res.json({ success: true, data: staff, message: 'Leave approved' });
  } catch (err) { next(err); }
});

// Record attendance
router.post('/:id/attendance', requirePermission('hr:write'), async (req, res, next) => {
  try {
    const staff = await Staff.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });
    await staff.recordAttendance(req.body);
    res.json({ success: true, data: staff });
  } catch (err) { next(err); }
});

// Add performance review
router.post('/:id/review', requirePermission('hr:write'), async (req, res, next) => {
  try {
    const staff = await Staff.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });
    staff.performanceReviews.push({
      ...req.body,
      reviewer: req.user._id,
    });
    await staff.save();
    res.json({ success: true, data: staff });
  } catch (err) { next(err); }
});

// Add payroll
router.post('/:id/payroll', requirePermission('hr:write'), async (req, res, next) => {
  try {
    const staff = await Staff.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });
    staff.payrollHistory.push(req.body);
    staff.stats.lastPayrollDate = new Date();
    // Next payroll = +1 month
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    staff.stats.nextPayrollDate = next;
    await staff.save();
    res.json({ success: true, data: staff });
  } catch (err) { next(err); }
});

// Attendance report
router.get('/attendance/today', requirePermission('hr:read'), async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const staff = await Staff.find({ ...tenantFilter(req), 'employment.status': 'active' })
      .select('fullName employeeId employment.position attendance');
    const report = staff.map(s => {
      const todayRecord = s.attendance?.find(a =>
        a.date >= today && a.date < tomorrow);
      return {
        staffId: s._id,
        fullName: s.fullName,
        employeeId: s.employeeId,
        position: s.employment?.position,
        attendance: todayRecord || null,
      };
    });
    res.json({ success: true, data: report, date: today });
  } catch (err) { next(err); }
});

export default router;
