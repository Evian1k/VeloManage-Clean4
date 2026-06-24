import mongoose from 'mongoose';

/**
 * Organization — the top-level tenant entity in VeloManage's multi-tenant SaaS.
 *
 * Every other domain document (Vehicle, Driver, Trip, FuelTransaction, etc.)
 * carries `organizationId` so we can enforce row-level isolation.
 *
 * An Organization can model:
 *   - A standalone company
 *   - A holding company with subsidiaries (subsidiaries are themselves Organizations
 *     linked via `parentId`)
 *   - A franchise network (franchisees are Organizations with `isFranchise: true`)
 *
 * Departments, Branches, and Teams live INSIDE an Organization and provide a
 * finer-grained organizational hierarchy for access control and reporting.
 */
const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with dashes'],
  },
  legalName: { type: String, trim: true },
  taxId: { type: String, trim: true },
  registrationNumber: { type: String, trim: true },
  industry: {
    type: String,
    enum: ['logistics', 'transport', 'delivery', 'rental', 'construction', 'public_transport', 'government', 'enterprise', 'other'],
    default: 'other',
  },
  // Multi-country
  country: { type: String, default: 'KE' }, // ISO 3166-1 alpha-2
  currency: { type: String, default: 'USD' }, // ISO 4217
  timezone: { type: String, default: 'Africa/Nairobi' },
  locale: { type: String, default: 'en' },

  // Hierarchy
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
  isFranchise: { type: Boolean, default: false },
  isSubsidiary: { type: Boolean, default: false },

  // Plan / billing
  plan: {
    type: String,
    enum: ['free', 'starter', 'business', 'enterprise', 'government'],
    default: 'free',
  },
  planStatus: {
    type: String,
    enum: ['trialing', 'active', 'past_due', 'canceled', 'suspended'],
    default: 'trialing',
  },
  trialEndsAt: { type: Date },

  // Limits (enforced in middleware)
  limits: {
    maxUsers: { type: Number, default: 10 },
    maxVehicles: { type: Number, default: 50 },
    maxBranches: { type: Number, default: 5 },
    maxStorageMb: { type: Number, default: 1024 },
  },

  // Contact / branding
  contactEmail: { type: String, trim: true, lowercase: true },
  contactPhone: { type: String, trim: true },
  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    coordinates: {
      latitude: Number,
      longitude: Number,
    },
  },
  branding: {
    logoUrl: String,
    primaryColor: { type: String, default: '#2563eb' },
    customDomain: { type: String, trim: true },
  },

  // Status
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  verificationDate: { type: Date },
  suspendedAt: { type: Date },
  suspensionReason: { type: String },

  // Settings
  settings: {
    requireMfaForAdmins: { type: Boolean, default: false },
    requireMfaForAll: { type: Boolean, default: false },
    ipWhitelist: [{ type: String }],
    sessionTimeoutMinutes: { type: Number, default: 60 },
    passwordPolicy: {
      minLength: { type: Number, default: 8 },
      requireUppercase: { type: Boolean, default: true },
      requireLowercase: { type: Boolean, default: true },
      requireNumbers: { type: Boolean, default: true },
      requireSymbols: { type: Boolean, default: false },
      passwordExpiryDays: { type: Number, default: 90 },
    },
    dataRetentionDays: { type: Number, default: 2555 }, // 7 years for compliance
    enableAuditLog: { type: Boolean, default: true },
  },

  // Lifecycle
  onboardedAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now },
}, { timestamps: true });

organizationSchema.index({ slug: 1 }, { unique: true });
organizationSchema.index({ parentId: 1 });
organizationSchema.index({ plan: 1, planStatus: 1 });
organizationSchema.index({ isActive: 1 });
organizationSchema.index({ country: 1 });

// Generate slug from name if not provided
organizationSchema.pre('validate', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }
  next();
});

organizationSchema.methods.isWithinLimits = async function(resource, currentCount) {
  const limit = this.limits[`max${resource}`];
  if (!limit || limit === -1) return true; // unlimited
  return currentCount < limit;
};

organizationSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const Organization = mongoose.model('Organization', organizationSchema);
export default Organization;
