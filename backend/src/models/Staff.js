import mongoose from 'mongoose';

/**
 * Staff — HR record (separate from User auth identity).
 * Tracks payroll, attendance, leave, performance.
 */
const attendanceSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  checkIn: Date,
  checkOut: Date,
  breakMinutes: { type: Number, default: 0 },
  workedMinutes: Number,
  overtimeMinutes: { type: Number, default: 0 },
  status: { type: String, enum: ['present', 'absent', 'late', 'half_day', 'remote', 'leave', 'holiday'], default: 'present' },
  location: { latitude: Number, longitude: Number, address: String },
  notes: String,
}, { _id: false });

const leaveRequestSchema = new mongoose.Schema({
  type: { type: String, enum: ['annual', 'sick', 'personal', 'maternity', 'paternity', 'bereavement', 'unpaid', 'study', 'sabbatical'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  days: Number,
  reason: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  approverNotes: String,
  appliedAt: { type: Date, default: Date.now },
}, { _id: false });

const performanceReviewSchema = new mongoose.Schema({
  reviewPeriod: { from: Date, to: Date },
  type: { type: String, enum: ['quarterly', 'mid_year', 'annual', 'probation', 'special'] },
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewDate: { type: Date, default: Date.now },
  ratings: {
    jobKnowledge: { type: Number, min: 1, max: 5 },
    quality: { type: Number, min: 1, max: 5 },
    productivity: { type: Number, min: 1, max: 5 },
    communication: { type: Number, min: 1, max: 5 },
    teamwork: { type: Number, min: 1, max: 5 },
    punctuality: { type: Number, min: 1, max: 5 },
    initiative: { type: Number, min: 1, max: 5 },
    overall: { type: Number, min: 1, max: 5 },
  },
  strengths: String,
  improvements: String,
  goals: [String],
  trainingRecommended: [String],
  promotionRecommended: { type: Boolean, default: false },
  salaryReviewRecommended: { type: Boolean, default: false },
  employeeComments: String,
}, { _id: false });

const payrollSchema = new mongoose.Schema({
  period: { year: Number, month: Number }, // 2026, 5 = May 2026
  grossSalary: Number,
  allowances: [{
    name: String,
    amount: Number,
    taxable: { type: Boolean, default: true },
  }],
  deductions: [{
    name: String,
    amount: Number,
    type: { type: String, enum: ['tax', 'insurance', 'pension', 'loan', 'other'] },
  }],
  netSalary: Number,
  currency: { type: String, default: 'USD' },
  hoursWorked: Number,
  overtimeHours: Number,
  overtimeRate: Number,
  bonus: Number,
  penalty: Number,
  status: { type: String, enum: ['draft', 'approved', 'paid', 'cancelled'], default: 'draft' },
  paidAt: Date,
  paymentReference: String,
}, { _id: false });

const staffSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  departmentId: String,

  employeeId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  fullName: { type: String, required: true },
  email: { type: String, lowercase: true, trim: true, required: true },
  phone: { type: String, required: true },

  // Employment
  employment: {
    type: { type: String, enum: ['full_time', 'part_time', 'contract', 'intern', 'temporary', 'consultant'], default: 'full_time' },
    status: { type: String, enum: ['active', 'on_leave', 'suspended', 'terminated', 'resigned', 'retired'], default: 'active', index: true },
    hiredAt: { type: Date, default: Date.now },
    probationEndsAt: Date,
    terminatedAt: Date,
    terminationReason: String,
    position: String,
    department: String,
    reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    workLocation: String,
    shift: String,
  },

  // Compensation
  compensation: {
    baseSalary: Number,
    currency: { type: String, default: 'USD' },
    payFrequency: { type: String, enum: ['weekly', 'bi_weekly', 'monthly'], default: 'monthly' },
    hourlyRate: Number,
    overtimeRate: Number,
    bankAccount: {
      bankName: String,
      accountName: String,
      accountNumber: String, // last 4
      iban: String,
      swift: String,
    },
    taxId: String,
    taxExemptions: Number,
    benefits: [{
      name: String,
      value: Number,
      currency: String,
    }],
  },

  // HR records
  attendance: [attendanceSchema],
  leaveRequests: [leaveRequestSchema],
  leaveBalance: {
    annual: { type: Number, default: 21 },
    sick: { type: Number, default: 10 },
    personal: { type: Number, default: 5 },
    maternity: { type: Number, default: 90 },
    used: {
      annual: { type: Number, default: 0 },
      sick: { type: Number, default: 0 },
      personal: { type: Number, default: 0 },
      maternity: { type: Number, default: 0 },
    },
  },
  performanceReviews: [performanceReviewSchema],
  payrollHistory: [payrollSchema],

  // Personal (encrypted at rest)
  personal: {
    dateOfBirth: Date,
    gender: String,
    maritalStatus: String,
    nationalId: { type: String, select: false },
    nationality: String,
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    emergencyContact: { name: String, phone: String, relationship: String },
  },

  // Stats
  stats: {
    daysPresentYtd: { type: Number, default: 0 },
    daysAbsentYtd: { type: Number, default: 0 },
    lateDaysYtd: { type: Number, default: 0 },
    totalOvertimeHoursYtd: { type: Number, default: 0 },
    lastPayrollDate: Date,
    nextPayrollDate: Date,
  },

  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

staffSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });
staffSchema.index({ organizationId: 1, 'employment.status': 1 });
staffSchema.index({ organizationId: 1, departmentId: 1 });
staffSchema.index({ userId: 1 }, { unique: true });

staffSchema.methods.applyLeave = function(leaveRequest) {
  const days = Math.ceil((leaveRequest.endDate - leaveRequest.startDate) / (24 * 60 * 60 * 1000)) + 1;
  leaveRequest.days = days;
  leaveRequest.status = 'pending';
  this.leaveRequests.push(leaveRequest);
  return this.save();
};

staffSchema.methods.approveLeave = function(requestId, approverId, notes = '') {
  const req = this.leaveRequests.id(requestId);
  if (!req) throw new Error('Leave request not found');
  req.status = 'approved';
  req.approvedBy = approverId;
  req.approvedAt = new Date();
  req.approverNotes = notes;
  // Update leave balance
  const type = req.type === 'annual' ? 'annual' : req.type === 'sick' ? 'sick' : 'personal';
  if (this.leaveBalance.used[type] !== undefined) {
    this.leaveBalance.used[type] += req.days;
  }
  return this.save();
};

staffSchema.methods.recordAttendance = function(record) {
  // Replace existing record for same date
  const existingIdx = this.attendance.findIndex(a =>
    a.date.toDateString() === record.date.toDateString());
  if (existingIdx >= 0) {
    this.attendance[existingIdx] = record;
  } else {
    this.attendance.push(record);
  }
  // Update YTD stats
  if (record.status === 'present') this.stats.daysPresentYtd += 1;
  else if (record.status === 'absent') this.stats.daysAbsentYtd += 1;
  else if (record.status === 'late') this.stats.lateDaysYtd += 1;
  if (record.overtimeMinutes) this.stats.totalOvertimeHoursYtd += record.overtimeMinutes / 60;
  return this.save();
};

const Staff = mongoose.model('Staff', staffSchema);
export default Staff;
