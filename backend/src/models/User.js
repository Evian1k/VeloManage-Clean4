import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { ROLES } from '../config/rbac.js';

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * VeloManage User — enterprise multi-tenant model.
 *
 * Replaces the original single-tenant User model. Backward-compatible:
 *   - isAdmin field retained (derived from role)
 *   - preferences.theme kept
 *
 * Adds:
 *   - organizationId (tenant scoping)
 *   - branchId, departmentId (organizational hierarchy)
 *   - 16-role enum via ROLES
 *   - refresh token family (rotation + revocation)
 *   - MFA fields (TOTP)
 *   - session/device tracking
 *   - failed-login lockout
 *   - password history (prevent reuse)
 *   - GDPR consent + data retention
 */

// Refresh token sub-document (one user can have multiple active sessions/devices)
const refreshTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  family: { type: String, required: true }, // for rotation: all descendants of original token
  deviceName: { type: String },
  deviceType: { type: String, enum: ['web', 'ios', 'android', 'api', 'desktop', 'other'], default: 'web' },
  userAgent: { type: String },
  ipAddress: { type: String },
  lastUsedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
  revokedReason: { type: String },
}, { _id: false });

const loginHistorySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  ipAddress: { type: String },
  userAgent: { type: String },
  deviceType: { type: String },
  success: { type: Boolean, required: true },
  failureReason: { type: String },
  geo: {
    country: String,
    city: String,
    latitude: Number,
    longitude: Number,
  },
}, { _id: false });

const userSchema = new mongoose.Schema({
  // Identity
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  avatar: { type: String },

  // Auth
  password: { type: String, required: true, minlength: 8, select: false },
  passwordChangedAt: { type: Date, default: Date.now },
  passwordHistory: [{ type: String }], // last 5 password hashes — prevents reuse

  // Multi-tenant + org hierarchy
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  departmentId: { type: String },
  reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Role
  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.READ_ONLY_USER,
    required: true,
  },
  // Backward-compat derived flag
  isAdmin: { type: Boolean, default: false },
  permissions: [{ type: String }], // additional permissions on top of role

  // Status
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  isSuspended: { type: Boolean, default: false },
  suspendedAt: { type: Date },
  suspendedReason: { type: String },
  lastLoginAt: { type: Date },
  lastLoginIp: { type: String },

  // Login lockout (OWASP)
  failedLoginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },

  // Tokens & sessions
  refreshTokens: [refreshTokenSchema],
  loginHistory: [loginHistorySchema],

  // MFA
  mfa: {
    enabled: { type: Boolean, default: false },
    method: { type: String, enum: ['totp', 'sms', 'email', 'none'], default: 'none' },
    secret: { type: String, select: false }, // TOTP secret, encrypted at rest
    backupCodes: [{ type: String, select: false }],
    enabledAt: { type: Date },
    lastUsedAt: { type: Date },
  },

  // OAuth (Google, Microsoft, SAML)
  oauth: {
    google: { id: String, email: String },
    microsoft: { id: String, email: String },
    saml: { id: String, issuer: String },
  },

  // Profile (GDPR-friendly, all optional)
  profile: {
    firstName: String,
    lastName: String,
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    nationalId: { type: String, select: false }, // encrypted at rest
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    emergencyContact: {
      name: String,
      phone: String,
      relationship: String,
    },
  },

  // Driver-specific (denormalized from Driver model for quick access)
  driverProfile: {
    licenseNumber: { type: String, select: false },
    licenseExpiry: { type: Date },
    licenseClass: [String],
    assignedVehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  },

  // Preferences
  preferences: {
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'Africa/Nairobi' },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'dark' },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
    },
  },

  // GDPR / compliance
  consent: {
    termsAcceptedAt: { type: Date },
    privacyAcceptedAt: { type: Date },
    marketingOptIn: { type: Boolean, default: false },
    dataProcessingConsent: { type: Boolean, default: false },
  },
  dataRetention: {
    deleteAfter: { type: Date }, // for compliance with right-to-be-forgotten
    anonymizedAt: { type: Date },
  },

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// ─── Indexes ────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ organizationId: 1, role: 1 });
userSchema.index({ organizationId: 1, isActive: 1 });
userSchema.index({ branchId: 1 });
userSchema.index({ 'oauth.google.id': 1 }, { sparse: true });
userSchema.index({ 'oauth.microsoft.id': 1 }, { sparse: true });
userSchema.index({ 'refreshTokens.tokenHash': 1 }, { sparse: true });
userSchema.index({ createdAt: -1 });

// ─── Password hashing ───────────────────────────────────────────────────────
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = new Date();
    // Push to history, keep last 5
    this.passwordHistory.push(this.password);
    if (this.passwordHistory.length > 5) this.passwordHistory.shift();
    next();
  } catch (err) { next(err); }
});

// Derive isAdmin from role on save
userSchema.pre('save', function(next) {
  const adminRoles = [ROLES.SUPER_ADMIN, ROLES.PLATFORM_OWNER, ROLES.COMPANY_OWNER,
                      ROLES.REGIONAL_MANAGER, ROLES.FLEET_MANAGER, ROLES.OPERATIONS_MANAGER,
                      ROLES.BRANCH_MANAGER];
  this.isAdmin = adminRoles.includes(this.role);
  next();
});

// ─── Methods ────────────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordHistory;
  delete obj.mfa?.secret;
  delete obj.mfa?.backupCodes;
  delete obj.profile?.nationalId;
  delete obj.driverProfile?.licenseNumber;
  delete obj.refreshTokens;
  return obj;
};

// JWT access token (short-lived, ~15 min)
userSchema.methods.generateAccessToken = function() {
  return jwt.sign(
    { userId: this._id, role: this.role, organizationId: this.organizationId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' },
  );
};

// JWT refresh token (long-lived, ~30 days) — hash stored, raw returned to client
userSchema.methods.generateRefreshToken = function(deviceInfo = {}) {
  const family = deviceInfo.family || new mongoose.Types.ObjectId().toString();
  const raw = jwt.sign(
    { userId: this._id, family, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' },
  );
  return { raw, family, hash: hashToken(raw), deviceInfo };
};

userSchema.methods.addRefreshToken = function(raw, family, deviceInfo, ttlDays = 30) {
  const hash = hashToken(raw);
  this.refreshTokens.push({
    tokenHash: hash,
    family,
    deviceName: deviceInfo.name,
    deviceType: deviceInfo.type,
    userAgent: deviceInfo.userAgent,
    ipAddress: deviceInfo.ipAddress,
    expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
  });
  // Cap concurrent sessions at 10
  if (this.refreshTokens.length > 10) this.refreshTokens.shift();
};

userSchema.methods.verifyRefreshToken = function(raw) {
  const hash = hashToken(raw);
  return this.refreshTokens.find(
    (t) => t.tokenHash === hash && !t.revokedAt && t.expiresAt > new Date(),
  );
};

userSchema.methods.revokeRefreshToken = function(raw, reason = 'revoked') {
  const hash = hashToken(raw);
  const token = this.refreshTokens.find((t) => t.tokenHash === hash);
  if (token) {
    token.revokedAt = new Date();
    token.revokedReason = reason;
  }
};

// Revoke all tokens in a family (used when refresh-token rotation detects reuse)
userSchema.methods.revokeRefreshTokenFamily = function(family, reason = 'token_reuse_detected') {
  this.refreshTokens.forEach((t) => {
    if (t.family === family) {
      t.revokedAt = new Date();
      t.revokedReason = reason;
    }
  });
};

userSchema.methods.revokeAllRefreshTokens = function(reason = 'logout_all') {
  this.refreshTokens.forEach((t) => {
    t.revokedAt = new Date();
    t.revokedReason = reason;
  });
};

userSchema.methods.recordLoginAttempt = function(success, ip, userAgent, geo = {}, failureReason = null) {
  this.loginHistory.push({
    timestamp: new Date(),
    ipAddress: ip,
    userAgent,
    success,
    failureReason,
    geo,
  });
  // Keep last 50 attempts
  if (this.loginHistory.length > 50) this.loginHistory.shift();

  if (success) {
    this.failedLoginAttempts = 0;
    this.lockedUntil = null;
    this.lastLoginAt = new Date();
    this.lastLoginIp = ip;
  } else {
    this.failedLoginAttempts += 1;
    if (this.failedLoginAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    }
  }
};

userSchema.methods.isLocked = function() {
  return this.lockedUntil && this.lockedUntil > new Date();
};

const User = mongoose.model('User', userSchema);
export default User;
