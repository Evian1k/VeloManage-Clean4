import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { recordAudit } from '../models/AuditLog.js';
import { ROLES } from '../config/rbac.js';

const router = express.Router();

// ─── Helpers ───────────────────────────────────────────────────────────────
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user._id, role: user.role, organizationId: user.organizationId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' },
  );
}

function generateRefreshToken(user, deviceInfo = {}) {
  const family = deviceInfo.family || crypto.randomUUID();
  const raw = jwt.sign(
    { userId: user._id, family, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' },
  );
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, family, hash };
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) ||
         req.headers['x-real-ip'] ||
         req.socket?.remoteAddress ||
         '0.0.0.0';
}

function parseUserAgent(ua = '') {
  if (/mobile/i.test(ua)) return 'mobile';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad/i.test(ua)) return 'ios';
  if (/postman|curl|insomnia/i.test(ua)) return 'api';
  return 'web';
}

// ─── Register ──────────────────────────────────────────────────────────────
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('organizationId').optional().isMongoId(),
  body('role').optional().isIn(Object.values(ROLES)),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, phone, organizationId, role } = req.body;

    // Check existing user
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered. Please log in.',
        code: 'EMAIL_EXISTS',
      });
    }

    // Validate org & role
    let orgId = organizationId;
    let assignedRole = role || ROLES.READ_ONLY_USER;

    // If no org specified, only platform admins can be created via this path
    if (!orgId && ![ROLES.SUPER_ADMIN, ROLES.PLATFORM_OWNER].includes(assignedRole)) {
      return res.status(400).json({
        success: false,
        message: 'organizationId is required for tenant users.',
      });
    }

    if (orgId) {
      const org = await Organization.findById(orgId);
      if (!org) {
        return res.status(404).json({ success: false, message: 'Organization not found.' });
      }
      if (!org.isActive) {
        return res.status(403).json({ success: false, message: 'Organization is suspended.' });
      }
      // Check user limit
      const userCount = await User.countDocuments({ organizationId: orgId, isActive: true });
      if (!await org.isWithinLimits('Users', userCount)) {
        return res.status(403).json({
          success: false,
          message: `Organization user limit (${org.limits.maxUsers}) reached.`,
        });
      }
    }

    const user = new User({
      name, email, password, phone,
      organizationId: orgId,
      role: assignedRole,
      isActive: true,
      isVerified: false,
      consent: {
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
        dataProcessingConsent: true,
      },
    });

    await user.save();

    // Tokens
    const deviceInfo = {
      type: parseUserAgent(req.headers['user-agent']),
      userAgent: req.headers['user-agent'],
      ipAddress: getClientIp(req),
    };
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user, deviceInfo);
    user.addRefreshToken(refreshToken.raw, refreshToken.family, deviceInfo);
    await user.save();

    // Audit
    await recordAudit({
      userId: user._id,
      userRole: user.role,
      userEmail: user.email,
      organizationId: user.organizationId,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      action: 'user.register',
      category: 'auth',
      status: 'success',
      statusCode: 201,
      method: 'POST',
      path: '/api/v1/auth/register',
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token: accessToken,
      refreshToken: refreshToken.raw,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered.',
        code: 'EMAIL_EXISTS',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
});

// ─── Login ─────────────────────────────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { email, password, mfaCode } = req.body;
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Lockout check
    if (user.isLocked()) {
      return res.status(423).json({
        success: false,
        message: 'Account locked due to too many failed attempts. Try again in 15 minutes.',
      });
    }

    if (!user.isActive || user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Contact your administrator.',
      });
    }

    // Password check
    const match = await user.comparePassword(password);
    if (!match) {
      user.recordLoginAttempt(false, ip, userAgent, null, 'invalid_password');
      await user.save();
      await recordAudit({
        userId: user._id, userRole: user.role, userEmail: user.email,
        organizationId: user.organizationId, ipAddress: ip, userAgent,
        action: 'auth.login', category: 'auth', severity: 'warning',
        status: 'failure', statusCode: 401, method: 'POST', path: '/api/v1/auth/login',
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // MFA check (if enabled)
    if (user.mfa?.enabled && user.mfa.method === 'totp') {
      if (!mfaCode) {
        return res.status(200).json({
          success: false,
          mfaRequired: true,
          message: 'MFA code required',
        });
      }
      // Verify TOTP (would integrate with speakeasy/otplib in production)
      // For now, this is a hook for that integration
      // const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token: mfaCode });
      // if (!verified) return res.status(401).json({ success: false, message: 'Invalid MFA code' });
    }

    // Success
    user.recordLoginAttempt(true, ip, userAgent);
    const deviceInfo = {
      type: parseUserAgent(userAgent),
      userAgent,
      ipAddress: ip,
    };
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user, deviceInfo);
    user.addRefreshToken(refreshToken.raw, refreshToken.family, deviceInfo);
    await user.save();

    await recordAudit({
      userId: user._id, userRole: user.role, userEmail: user.email,
      organizationId: user.organizationId, ipAddress: ip, userAgent,
      action: 'auth.login', category: 'auth', status: 'success',
      statusCode: 200, method: 'POST', path: '/api/v1/auth/login',
    });

    res.json({
      success: true,
      message: 'Login successful',
      token: accessToken,
      refreshToken: refreshToken.raw,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// ─── Refresh token ─────────────────────────────────────────────────────────
router.post('/refresh', [
  body('refreshToken').notEmpty(),
], async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'refreshToken required' });
    }

    // Verify signature
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, message: 'Not a refresh token' });
    }

    const user = await User.findById(decoded.userId).select('+refreshTokens');
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // Check token is known & valid (rotation)
    const stored = user.verifyRefreshToken(refreshToken);
    if (!stored) {
      // Possible token reuse — revoke entire family
      if (decoded.family) {
        user.revokeRefreshTokenFamily(decoded.family, 'token_reuse_detected');
        await user.save();
        await recordAudit({
          userId: user._id, userRole: user.role, userEmail: user.email,
          organizationId: user.organizationId, ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
          action: 'auth.refresh_token_reuse', category: 'auth', severity: 'critical',
          status: 'failure', statusCode: 401, method: 'POST', path: '/api/v1/auth/refresh',
        });
      }
      return res.status(401).json({ success: false, message: 'Token reuse detected. All sessions revoked.' });
    }

    // Rotate: revoke old, issue new in same family
    user.revokeRefreshToken(refreshToken, 'rotated');
    const deviceInfo = {
      family: decoded.family,
      type: stored.deviceType,
      userAgent: stored.userAgent,
      ipAddress: getClientIp(req),
      name: stored.deviceName,
    };
    const newRefresh = generateRefreshToken(user, deviceInfo);
    user.addRefreshToken(newRefresh.raw, newRefresh.family, deviceInfo);
    await user.save();

    const newAccess = generateAccessToken(user);
    res.json({
      success: true,
      token: newAccess,
      refreshToken: newRefresh.raw,
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ success: false, message: 'Server error during token refresh' });
  }
});

// ─── Logout (revoke refresh token) ─────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const { refreshToken } = req.body;

    // Best-effort: revoke refresh token even if access token expired
    if (refreshToken) {
      let decoded;
      try { decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET); } catch {}
      if (decoded?.userId) {
        const user = await User.findById(decoded.userId).select('+refreshTokens');
        if (user) {
          user.revokeRefreshToken(refreshToken, 'logout');
          await user.save();
        }
      }
    }
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error during logout' });
  }
});

// ─── Logout from all devices ───────────────────────────────────────────────
router.post('/logout-all', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('+refreshTokens');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.revokeAllRefreshTokens('logout_all');
    await user.save();
    await recordAudit({
      userId: user._id, userRole: user.role, userEmail: user.email,
      organizationId: user.organizationId, ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      action: 'auth.logout_all', category: 'auth',
      status: 'success', statusCode: 200, method: 'POST', path: '/api/v1/auth/logout-all',
    });
    res.json({ success: true, message: 'All sessions revoked' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Verify token ──────────────────────────────────────────────────────────
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid token or user not found' });
    }
    res.json({ success: true, user: user.toJSON() });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// ─── Password reset request ────────────────────────────────────────────────
router.post('/password-reset/request', [
  body('email').isEmail().normalizeEmail(),
], async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    // Don't leak existence — return same response either way
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(resetToken).digest('hex');
      // In production: store hash with expiry, send email with link
      // For now: just record the audit
      await recordAudit({
        userId: user._id, userRole: user.role, userEmail: user.email,
        organizationId: user.organizationId, ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        action: 'auth.password_reset_request', category: 'auth',
        status: 'success', method: 'POST', path: '/api/v1/auth/password-reset/request',
      });
    }
    res.json({ success: true, message: 'If the email exists, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Change password (authenticated) ───────────────────────────────────────
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('+password +passwordHistory');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'currentPassword and newPassword required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }

    const match = await user.comparePassword(currentPassword);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Check password history (prevent reuse of last 5)
    for (const oldHash of user.passwordHistory || []) {
      if (await bcrypt.compare(newPassword, oldHash)) {
        return res.status(400).json({ success: false, message: 'Password has been used recently. Choose a different one.' });
      }
    }

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    // Revoke all sessions — force re-login
    user.revokeAllRefreshTokens('password_change');
    await user.save();

    await recordAudit({
      userId: user._id, userRole: user.role, userEmail: user.email,
      organizationId: user.organizationId, ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      action: 'auth.password_change', category: 'auth', severity: 'warning',
      status: 'success', method: 'POST', path: '/api/v1/auth/change-password',
    });

    res.json({ success: true, message: 'Password changed. Please log in again.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Get active sessions ───────────────────────────────────────────────────
router.get('/sessions', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('+refreshTokens');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const activeSessions = user.refreshTokens
      .filter(t => !t.revokedAt && t.expiresAt > new Date())
      .map(t => ({
        deviceName: t.deviceName,
        deviceType: t.deviceType,
        ipAddress: t.ipAddress,
        lastUsedAt: t.lastUsedAt,
        expiresAt: t.expiresAt,
        family: t.family,
      }));
    res.json({ success: true, sessions: activeSessions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
