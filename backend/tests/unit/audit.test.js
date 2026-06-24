/**
 * Unit tests for the AuditLog model's helper functions:
 *   - sanitizeForLog  (pure recursive redactor)
 *   - recordAudit     (non-blocking fire-and-forget writer)
 *
 * Covers src/models/AuditLog.js
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

import AuditLog, { sanitizeForLog, recordAudit } from '../../src/models/AuditLog.js';

describe('sanitizeForLog — sensitive field redaction', () => {
  test('redacts `password`', () => {
    const out = sanitizeForLog({ email: 'a@b.com', password: 'hunter2' });
    expect(out.email).toBe('a@b.com');
    expect(out.password).toBe('[REDACTED]');
  });

  test('redacts `token`', () => {
    const out = sanitizeForLog({ token: 'jwt-payload-here' });
    expect(out.token).toBe('[REDACTED]');
  });

  test('redacts `refreshToken`', () => {
    const out = sanitizeForLog({ refreshToken: 'abc.def.ghi' });
    expect(out.refreshToken).toBe('[REDACTED]');
  });

  test('redacts `cardNumber`', () => {
    const out = sanitizeForLog({ cardNumber: '4242424242424242' });
    expect(out.cardNumber).toBe('[REDACTED]');
  });

  test('redacts `cvv`', () => {
    const out = sanitizeForLog({ cvv: '123' });
    expect(out.cvv).toBe('[REDACTED]');
  });

  test('redacts `apiKey`', () => {
    const out = sanitizeForLog({ apiKey: 'sk_live_xxxxxxxx' });
    expect(out.apiKey).toBe('[REDACTED]');
  });

  test('redacts `secret`, `newPassword`, `confirmPassword`, `authorization`', () => {
    const out = sanitizeForLog({
      secret: 'shh',
      newPassword: 'new-pass',
      confirmPassword: 'new-pass',
      authorization: 'Bearer xyz',
    });
    expect(out.secret).toBe('[REDACTED]');
    expect(out.newPassword).toBe('[REDACTED]');
    expect(out.confirmPassword).toBe('[REDACTED]');
    expect(out.authorization).toBe('[REDACTED]');
  });

  test('preserves non-sensitive fields', () => {
    const input = {
      name: 'Jane',
      email: 'jane@example.com',
      role: 'fleet_manager',
      organizationId: '507f1f77bcf86cd799439011',
      isActive: true,
      count: 7,
    };
    const out = sanitizeForLog(input);
    expect(out).toEqual(input); // nothing redacted
  });

  test('handles nested objects (recurses)', () => {
    const out = sanitizeForLog({
      user: {
        name: 'Jane',
        password: 'secret123',
      },
      metadata: {
        token: 'xyz',
        notes: 'ok',
      },
    });
    expect(out.user.name).toBe('Jane');
    expect(out.user.password).toBe('[REDACTED]');
    expect(out.metadata.token).toBe('[REDACTED]');
    expect(out.metadata.notes).toBe('ok');
  });

  test('handles arrays (recurses into elements)', () => {
    const out = sanitizeForLog([
      { name: 'a', password: 'p1' },
      { name: 'b', token: 't2' },
    ]);
    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe('a');
    expect(out[0].password).toBe('[REDACTED]');
    expect(out[1].name).toBe('b');
    expect(out[1].token).toBe('[REDACTED]');
  });

  test('handles null and undefined (passes through unchanged)', () => {
    expect(sanitizeForLog(null)).toBeNull();
    expect(sanitizeForLog(undefined)).toBeUndefined();
  });

  test('handles primitive values (passes through unchanged)', () => {
    expect(sanitizeForLog(42)).toBe(42);
    expect(sanitizeForLog('hello')).toBe('hello');
    expect(sanitizeForLog(true)).toBe(true);
    expect(sanitizeForLog(false)).toBe(false);
  });

  test('does NOT mutate the original input (returns a copy)', () => {
    const input = { password: 'hunter2', name: 'Jane' };
    const out = sanitizeForLog(input);
    expect(input.password).toBe('hunter2'); // original unchanged
    expect(out.password).toBe('[REDACTED]');
  });

  test('matches sensitive keys case-insensitively (substring match)', () => {
    // sanitizeForLog lowercases both the key and the sensitive term, then
    // uses String.prototype.includes — so any case variant of a sensitive
    // key gets redacted, as long as the substring appears verbatim.
    const out = sanitizeForLog({
      Password: 'P1',       // 'password'.includes('password') ✓
      TOKEN: 't1',          // 'token'.includes('token') ✓
      apiKeyValue: 'k1',    // 'apikeyvalue'.includes('apikey') ✓
    });
    expect(out.Password).toBe('[REDACTED]');
    expect(out.TOKEN).toBe('[REDACTED]');
    expect(out.apiKeyValue).toBe('[REDACTED]');
  });

  test('does NOT redact keys whose only similarity is semantic (underscore variant)', () => {
    // Documents a known limitation: 'api_key' does not contain the substring
    // 'apikey' because of the underscore. This is the actual behavior of
    // sanitizeForLog; if we want to catch underscore variants, the matcher
    // would need to normalize separators first.
    const out = sanitizeForLog({ api_key: 'k1' });
    expect(out.api_key).toBe('k1'); // NOT redacted — known limitation
  });

  test('handles deeply nested structures', () => {
    const out = sanitizeForLog({
      level1: {
        level2: {
          level3: {
            password: 'deep',
            data: 'ok',
          },
        },
      },
    });
    expect(out.level1.level2.level3.password).toBe('[REDACTED]');
    expect(out.level1.level2.level3.data).toBe('ok');
  });
});

describe('recordAudit — non-blocking fire-and-forget', () => {
  let createMock;

  beforeEach(() => {
    // Replace AuditLog.create with a fresh mock before each test
    createMock = jest.fn().mockResolvedValue({});
    AuditLog.create = createMock;
  });

  test('writes an audit log entry via AuditLog.create', async () => {
    await recordAudit({
      userId: '507f1f77bcf86cd799439011',
      userRole: 'fleet_manager',
      userEmail: 'jane@example.com',
      ipAddress: '127.0.0.1',
      action: 'vehicle.create',
      category: 'vehicle',
      status: 'success',
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0][0];
    expect(arg.action).toBe('vehicle.create');
    expect(arg.category).toBe('vehicle');
    expect(arg.userId).toBe('507f1f77bcf86cd799439011');
  });

  test('sanitizes requestBody before writing', async () => {
    await recordAudit({
      userId: '507f1f77bcf86cd799439011',
      userRole: 'fleet_manager',
      userEmail: 'jane@example.com',
      ipAddress: '127.0.0.1',
      action: 'user.update',
      category: 'user',
      requestBody: { name: 'Jane', password: 'secret123' },
    });

    const arg = createMock.mock.calls[0][0];
    expect(arg.requestBody.password).toBe('[REDACTED]');
    expect(arg.requestBody.name).toBe('Jane');
  });

  test('sanitizes `before` and `after` changesets', async () => {
    await recordAudit({
      userId: '507f1f77bcf86cd799439011',
      userRole: 'admin',
      userEmail: 'a@b.com',
      ipAddress: '127.0.0.1',
      action: 'user.update',
      category: 'user',
      before: { password: 'old' },
      after: { password: 'new' },
    });

    const arg = createMock.mock.calls[0][0];
    expect(arg.before.password).toBe('[REDACTED]');
    expect(arg.after.password).toBe('[REDACTED]');
  });

  test('does NOT throw when DB is unavailable (logs error and resolves)', async () => {
    // Simulate a DB outage
    createMock.mockRejectedValue(new Error('Connection refused'));

    // recordAudit should swallow the error and resolve with undefined
    await expect(recordAudit({
      userId: '507f1f77bcf86cd799439011',
      userRole: 'admin',
      userEmail: 'a@b.com',
      ipAddress: '127.0.0.1',
      action: 'test.action',
      category: 'other',
    })).resolves.toBeUndefined();
  });

  test('defaults severity to "info" and status to "success"', async () => {
    await recordAudit({
      userId: '507f1f77bcf86cd799439011',
      userRole: 'admin',
      userEmail: 'a@b.com',
      ipAddress: '127.0.0.1',
      action: 'x',
      category: 'other',
    });

    const arg = createMock.mock.calls[0][0];
    expect(arg.severity).toBe('info');
    expect(arg.status).toBe('success');
  });
});
