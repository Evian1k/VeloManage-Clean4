/**
 * Unit tests for the User model instance methods.
 *
 * Unlike the integration tests (which mock User.js), this test imports the
 * REAL User model and exercises its instance methods directly. No DB
 * connection is needed — we construct instances with `new User({...})` and
 * call methods that operate purely on in-memory document state.
 *
 * Covers: comparePassword, isLocked, recordLoginAttempt, addRefreshToken,
 *         verifyRefreshToken, revokeRefreshToken, revokeAllRefreshTokens,
 *         revokeRefreshTokenFamily, toJSON
 */
import { describe, test, expect, beforeAll } from '@jest/globals';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

import User from '../../src/models/User.js';
import { ROLES } from '../../src/config/rbac.js';

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Pre-hashed password for testing comparePassword without triggering the
// pre-save hook (which would try to write to MongoDB).
const PLAIN_PASSWORD = 'TestPassword123!';
let HASHED_PASSWORD;

beforeAll(async () => {
  HASHED_PASSWORD = await bcrypt.hash(PLAIN_PASSWORD, 12);
});

function makeUser(overrides = {}) {
  // `new User({...})` does NOT hit the DB — it just constructs a document.
  // We set password to the pre-hashed value so comparePassword works without
  // triggering the pre-save hashing hook.
  return new User({
    name: 'Test User',
    email: 'test@example.com',
    password: HASHED_PASSWORD,
    role: ROLES.FLEET_MANAGER,
    isActive: true,
    isSuspended: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    refreshTokens: [],
    loginHistory: [],
    passwordHistory: [],
    ...overrides,
  });
}

describe('User.comparePassword', () => {
  test('returns true for the correct plaintext password', async () => {
    const user = makeUser();
    expect(await user.comparePassword(PLAIN_PASSWORD)).toBe(true);
  });

  test('returns false for an incorrect password', async () => {
    const user = makeUser();
    expect(await user.comparePassword('wrong-password')).toBe(false);
  });

  test('returns false for an empty password', async () => {
    const user = makeUser();
    expect(await user.comparePassword('')).toBe(false);
  });
});

describe('User.isLocked', () => {
  test('returns falsy when lockedUntil is null', () => {
    // isLocked() returns `this.lockedUntil && this.lockedUntil > new Date()`
    // — short-circuits to null when lockedUntil is null.
    const user = makeUser({ lockedUntil: null });
    expect(user.isLocked()).toBeFalsy();
  });

  test('returns false when lockedUntil is in the past', () => {
    const user = makeUser({ lockedUntil: new Date(Date.now() - 60_000) });
    expect(user.isLocked()).toBe(false);
  });

  test('returns true when lockedUntil is in the future', () => {
    const user = makeUser({ lockedUntil: new Date(Date.now() + 15 * 60_000) });
    expect(user.isLocked()).toBe(true);
  });
});

describe('User.recordLoginAttempt', () => {
  test('on success: resets failedLoginAttempts, clears lock, sets lastLoginAt', () => {
    const user = makeUser({ failedLoginAttempts: 3, lockedUntil: new Date(Date.now() + 60_000) });
    const before = Date.now();
    user.recordLoginAttempt(true, '127.0.0.1', 'test-agent');
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(user.lastLoginAt).toBeInstanceOf(Date);
    expect(user.lastLoginAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(user.lastLoginIp).toBe('127.0.0.1');
    expect(user.loginHistory).toHaveLength(1);
    expect(user.loginHistory[0].success).toBe(true);
  });

  test('on failure: increments failedLoginAttempts', () => {
    const user = makeUser({ failedLoginAttempts: 0 });
    user.recordLoginAttempt(false, '127.0.0.1', 'agent', null, 'invalid_password');
    expect(user.failedLoginAttempts).toBe(1);
    expect(user.loginHistory).toHaveLength(1);
    expect(user.loginHistory[0].success).toBe(false);
    expect(user.loginHistory[0].failureReason).toBe('invalid_password');
  });

  test('locks the account after 5 failed attempts', () => {
    const user = makeUser({ failedLoginAttempts: 4 });
    user.recordLoginAttempt(false, '127.0.0.1', 'agent');
    expect(user.failedLoginAttempts).toBe(5);
    expect(user.lockedUntil).toBeInstanceOf(Date);
    expect(user.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  test('keeps only the last 50 login history entries', () => {
    const user = makeUser();
    for (let i = 0; i < 55; i++) {
      user.recordLoginAttempt(true, '127.0.0.1', 'agent');
    }
    expect(user.loginHistory.length).toBe(50);
  });
});

describe('User.addRefreshToken', () => {
  test('pushes a new token entry with the hashed value', () => {
    const user = makeUser();
    const raw = 'raw-refresh-token';
    user.addRefreshToken(raw, 'family-1', { type: 'web', userAgent: 'Chrome', ipAddress: '127.0.0.1' });
    expect(user.refreshTokens).toHaveLength(1);
    const entry = user.refreshTokens[0];
    expect(entry.tokenHash).not.toBe(raw); // stored as hash, not raw
    expect(entry.family).toBe('family-1');
    expect(entry.deviceType).toBe('web');
    expect(entry.expiresAt).toBeInstanceOf(Date);
    expect(entry.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('caps concurrent sessions at 10 (oldest evicted)', () => {
    const user = makeUser();
    for (let i = 0; i < 12; i++) {
      user.addRefreshToken(`token-${i}`, `family-${i}`, {});
    }
    expect(user.refreshTokens.length).toBe(10);
    // The first two should have been evicted
    expect(user.refreshTokens[0].family).not.toBe('family-0');
  });
});

describe('User.verifyRefreshToken', () => {
  test('returns the stored entry for a valid, non-revoked, non-expired token', () => {
    const user = makeUser();
    user.addRefreshToken('my-token', 'fam-1', { type: 'web' });
    const entry = user.verifyRefreshToken('my-token');
    expect(entry).toBeDefined();
    expect(entry.family).toBe('fam-1');
  });

  test('returns undefined for an unknown token', () => {
    const user = makeUser();
    user.addRefreshToken('my-token', 'fam-1', {});
    expect(user.verifyRefreshToken('different-token')).toBeUndefined();
  });

  test('returns undefined for a revoked token', () => {
    const user = makeUser();
    user.addRefreshToken('my-token', 'fam-1', {});
    user.revokeRefreshToken('my-token', 'logout');
    expect(user.verifyRefreshToken('my-token')).toBeUndefined();
  });

  test('returns undefined for an expired token', () => {
    const user = makeUser();
    // Manually push an expired token
    user.refreshTokens.push({
      tokenHash: hashToken('expired'),
      family: 'fam-1',
      expiresAt: new Date(Date.now() - 60_000), // expired
      revokedAt: null,
    });
    expect(user.verifyRefreshToken('expired')).toBeUndefined();
  });
});

describe('User.revokeRefreshToken', () => {
  test('marks the matching token as revoked with a reason', () => {
    const user = makeUser();
    user.addRefreshToken('my-token', 'fam-1', {});
    user.revokeRefreshToken('my-token', 'logout');
    const entry = user.refreshTokens[0];
    expect(entry.revokedAt).toBeInstanceOf(Date);
    expect(entry.revokedReason).toBe('logout');
  });

  test('is a no-op when the token does not exist', () => {
    const user = makeUser();
    user.revokeRefreshToken('nonexistent', 'logout');
    expect(user.refreshTokens).toHaveLength(0);
  });
});

describe('User.revokeRefreshTokenFamily', () => {
  test('revokes ALL tokens in the specified family', () => {
    const user = makeUser();
    user.addRefreshToken('t1', 'fam-A', {});
    user.addRefreshToken('t2', 'fam-A', {});
    user.addRefreshToken('t3', 'fam-B', {});
    user.revokeRefreshTokenFamily('fam-A', 'reuse_detected');
    const famA = user.refreshTokens.filter((t) => t.family === 'fam-A');
    const famB = user.refreshTokens.filter((t) => t.family === 'fam-B');
    expect(famA.every((t) => t.revokedAt)).toBe(true);
    expect(famA.every((t) => t.revokedReason === 'reuse_detected')).toBe(true);
    expect(famB.every((t) => !t.revokedAt)).toBe(true); // fam-B untouched
  });
});

describe('User.revokeAllRefreshTokens', () => {
  test('revokes every token regardless of family', () => {
    const user = makeUser();
    user.addRefreshToken('t1', 'fam-A', {});
    user.addRefreshToken('t2', 'fam-B', {});
    user.addRefreshToken('t3', 'fam-C', {});
    user.revokeAllRefreshTokens('logout_all');
    expect(user.refreshTokens.every((t) => t.revokedAt)).toBe(true);
    expect(user.refreshTokens.every((t) => t.revokedReason === 'logout_all')).toBe(true);
  });
});

describe('User.toJSON', () => {
  test('strips password and passwordHistory from the output', () => {
    const user = makeUser({ passwordHistory: [HASHED_PASSWORD] });
    const json = user.toJSON();
    expect(json).not.toHaveProperty('password');
    expect(json).not.toHaveProperty('passwordHistory');
  });

  test('strips refreshTokens from the output', () => {
    const user = makeUser();
    user.addRefreshToken('t1', 'fam-1', {});
    const json = user.toJSON();
    expect(json).not.toHaveProperty('refreshTokens');
  });

  test('strips mfa.secret and mfa.backupCodes', () => {
    const user = makeUser({ mfa: { enabled: true, method: 'totp', secret: 'topsecret', backupCodes: ['11111'] } });
    const json = user.toJSON();
    expect(json.mfa).toBeDefined();
    expect(json.mfa).not.toHaveProperty('secret');
    expect(json.mfa).not.toHaveProperty('backupCodes');
  });

  test('preserves non-sensitive fields', () => {
    const user = makeUser({ name: 'Jane', email: 'jane@example.com', role: ROLES.FLEET_MANAGER });
    const json = user.toJSON();
    expect(json.name).toBe('Jane');
    expect(json.email).toBe('jane@example.com');
    expect(json.role).toBe(ROLES.FLEET_MANAGER);
  });
});

describe('User.generateAccessToken', () => {
  test('produces a valid JWT signed with JWT_SECRET', () => {
    const user = makeUser({ _id: '507f1f77bcf86cd799439011', role: ROLES.FLEET_MANAGER });
    const token = user.generateAccessToken();
    expect(typeof token).toBe('string');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.userId).toBe('507f1f77bcf86cd799439011');
    expect(decoded.role).toBe(ROLES.FLEET_MANAGER);
  });
});

describe('User.generateRefreshToken', () => {
  test('returns a raw token, family, and hash', () => {
    const user = makeUser({ _id: '507f1f77bcf86cd799439011' });
    const result = user.generateRefreshToken({ type: 'web' });
    expect(result.raw).toBeDefined();
    expect(result.family).toBeDefined();
    expect(result.hash).toBeDefined();
    // Hash should be a sha256 hex string (64 chars)
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('the raw token decodes as a refresh-type JWT', () => {
    const user = makeUser({ _id: '507f1f77bcf86cd799439011' });
    const { raw } = user.generateRefreshToken({});
    const decoded = jwt.verify(raw, process.env.JWT_REFRESH_SECRET);
    expect(decoded.type).toBe('refresh');
    expect(decoded.userId).toBe('507f1f77bcf86cd799439011');
  });

  test('preserves the provided family across rotation', () => {
    const user = makeUser({ _id: '507f1f77bcf86cd799439011' });
    const { family, raw } = user.generateRefreshToken({ family: 'my-family-123' });
    expect(family).toBe('my-family-123');
    const decoded = jwt.verify(raw, process.env.JWT_REFRESH_SECRET);
    expect(decoded.family).toBe('my-family-123');
  });
});
