import mongoose from 'mongoose';

/**
 * Audit Log — immutable record of every privileged action.
 *
 * Used for:
 *   - SOC2 compliance evidence
 *   - GDPR accountability
 *   - Internal investigations
 *   - Customer-facing "activity feed" in admin UI
 *
 * Records are write-once: no update/delete endpoints exist.
 * TTL archive rule moves records older than 7 years to cold storage.
 */
const auditLogSchema = new mongoose.Schema({
  // Who
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userRole: { type: String, required: true },
  userEmail: { type: String, required: true },

  // Where
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  ipAddress: { type: String, required: true },
  userAgent: { type: String },

  // What
  action: { type: String, required: true }, // e.g. 'vehicle.create', 'user.delete', 'auth.login'
  category: {
    type: String,
    enum: ['auth', 'user', 'vehicle', 'driver', 'maintenance', 'fuel', 'gps',
           'trip', 'compliance', 'accident', 'finance', 'hr', 'procurement',
           'asset', 'crm', 'vendor', 'settings', 'organization', 'export', 'other'],
    required: true,
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'info',
  },

  // Target
  resourceType: { type: String }, // e.g. 'Vehicle', 'User', 'Trip'
  resourceId: { type: String }, // kept as string to support non-ObjectId ids
  resourceName: { type: String },

  // Result
  status: { type: String, enum: ['success', 'failure', 'denied'], required: true },
  statusCode: { type: Number },

  // Context
  method: { type: String }, // HTTP method
  path: { type: String }, // request path
  requestBody: { type: mongoose.Schema.Types.Mixed }, // sanitized — passwords removed
  responseSummary: { type: mongoose.Schema.Types.Mixed },

  // Changeset (for audit-diff on update operations)
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },

  // Geo (for suspicious-login detection)
  geo: {
    country: String,
    city: String,
    latitude: Number,
    longitude: Number,
  },

  // Correlation
  traceId: { type: String },
  sessionId: { type: String },
}, { timestamps: { createdAt: 'timestamp', updatedAt: false } });

// No updatedAt — audit logs are immutable
auditLogSchema.set('timestamps', false);
auditLogSchema.index({ timestamp: 1 });
auditLogSchema.index({ organizationId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ category: 1, severity: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });

// TTL: archive records older than 7 years (2555 days)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2555 * 24 * 60 * 60 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

// Sanitize sensitive fields before logging
const SENSITIVE_KEYS = ['password', 'newPassword', 'confirmPassword', 'token',
  'refreshToken', 'secret', 'apiKey', 'cardNumber', 'cvv', 'authorization'];

export function sanitizeForLog(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const cleaned = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(cleaned)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof cleaned[key] === 'object' && cleaned[key] !== null) {
      cleaned[key] = sanitizeForLog(cleaned[key]);
    }
  }
  return cleaned;
}

/**
 * Write an audit log entry. Non-blocking (fire-and-forget) — failures are
 * logged to console but never block the request.
 */
export async function recordAudit(entry) {
  try {
    await AuditLog.create({
      userId: entry.userId,
      userRole: entry.userRole,
      userEmail: entry.userEmail,
      organizationId: entry.organizationId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      action: entry.action,
      category: entry.category,
      severity: entry.severity || 'info',
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      resourceName: entry.resourceName,
      status: entry.status || 'success',
      statusCode: entry.statusCode,
      method: entry.method,
      path: entry.path,
      requestBody: sanitizeForLog(entry.requestBody),
      responseSummary: entry.responseSummary,
      before: sanitizeForLog(entry.before),
      after: sanitizeForLog(entry.after),
      geo: entry.geo,
      traceId: entry.traceId,
      sessionId: entry.sessionId,
    });
  } catch (e) {
    console.error('Audit log write failed:', e.message);
  }
}

export default AuditLog;
