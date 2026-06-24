/**
 * Integration tests for the auth routes (/api/v1/auth/*).
 *
 * Uses jest.unstable_mockModule (ESM-compatible) to replace the User model
 * with a controllable mock so no real MongoDB is required.
 *
 * Covers:
 *   POST /register   - 400 on missing fields, 201 on valid input
 *   POST /login      - 401 on invalid creds, 200 + token on valid creds
 *   POST /refresh    - 400 on missing body, 401 on invalid token
 *   GET  /verify     - 401 without token
 *   Full register → login → verify cycle
 */
import { jest, describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';

// ─── Mock User model ───────────────────────────────────────────────────────
// A class so `new User(data)` works; static methods are jest.fn() so each
// test can configure return values via mockReturnValue / mockResolvedValue.

/**
 * Build a chainable thenable that mimics a Mongoose query:
 *   await Model.find(...)            → value
 *   await Model.find(...).select(..) → value
 *   await Model.find(...).lean()     → value
 */
function chainableQuery(resolvedValue) {
  const query = {};
  const promise = Promise.resolve(resolvedValue);
  query.select = jest.fn(() => query);
  query.populate = jest.fn(() => query);
  query.lean = jest.fn(() => query);
  query.sort = jest.fn(() => query);
  query.skip = jest.fn(() => query);
  query.limit = jest.fn(() => query);
  query.exec = jest.fn(() => promise);
  query.then = promise.then.bind(promise);
  query.catch = promise.catch.bind(promise);
  query.finally = promise.finally?.bind(promise);
  return query;
}

function makeMockUser(overrides = {}) {
  return {
    _id: '507f1f77bcf86cd799439011',
    name: 'Test User',
    email: 'test@example.com',
    role: 'fleet_manager',
    organizationId: null,
    isActive: true,
    isSuspended: false,
    isVerified: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    password: '$2a$12$hashedplaceholder',
    refreshTokens: [],
    mfa: { enabled: false, method: 'none' },
    ...overrides,
    // Instance methods
    save: jest.fn().mockResolvedValue(undefined),
    comparePassword: jest.fn().mockResolvedValue(false),
    addRefreshToken: jest.fn(),
    recordLoginAttempt: jest.fn(),
    isLocked: jest.fn().mockReturnValue(false),
    toJSON: jest.fn().mockReturnValue({
      _id: '507f1f77bcf86cd799439011',
      name: 'Test User',
      email: 'test@example.com',
      role: 'fleet_manager',
    }),
    verifyRefreshToken: jest.fn().mockReturnValue(null),
    revokeRefreshToken: jest.fn(),
    revokeRefreshTokenFamily: jest.fn(),
    revokeAllRefreshTokens: jest.fn(),
  };
}

class MockUser {
  constructor(data) {
    const inst = makeMockUser(data || {});
    Object.assign(this, inst);
  }
}
MockUser.findOne = jest.fn();
MockUser.findById = jest.fn();
MockUser.countDocuments = jest.fn().mockResolvedValue(0);

jest.unstable_mockModule('../../src/models/User.js', () => ({ default: MockUser }));

// ─── Mock AuditLog (recordAudit would otherwise try to hit MongoDB) ────────
jest.unstable_mockModule('../../src/models/AuditLog.js', () => ({
  default: { create: jest.fn().mockResolvedValue({}), modelName: 'AuditLog' },
  recordAudit: jest.fn().mockResolvedValue(undefined),
  sanitizeForLog: (obj) => obj,
}));

// ─── Dynamic imports (must come AFTER unstable_mockModule calls) ───────────
let request, createApp, app;

beforeAll(async () => {
  request = (await import('supertest')).default;
  createApp = (await import('../helpers/app.js')).createApp;
  app = createApp();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────
describe('Auth routes — POST /api/v1/auth/register', () => {
  test('returns 400 when required fields are missing', async () => {
    // Missing name, email, password
    const res = await request(app).post('/api/v1/auth/register').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('errors');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('returns 400 when password is too short (< 8 chars)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'short',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when email is malformed', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Jane Doe',
      email: 'not-an-email',
      password: 'password123',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when organizationId is missing for a tenant role', async () => {
    // fleet_manager requires an org
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'password123',
      role: 'fleet_manager',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/organizationId/i);
  });

  test('returns 201 on valid input (super_admin, no org required)', async () => {
    // Mock: no existing user with this email
    MockUser.findOne.mockReturnValue(chainableQuery(null));

    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'SuperSecret123',
      role: 'super_admin',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body).toHaveProperty('refreshToken');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body).toHaveProperty('user');
  });

  test('returns 409 when the email is already registered', async () => {
    // Mock: existing user found
    MockUser.findOne.mockReturnValue(chainableQuery(makeMockUser()));

    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Jane Doe',
      email: 'test@example.com',
      password: 'SuperSecret123',
      role: 'super_admin',
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('EMAIL_EXISTS');
  });
});

describe('Auth routes — POST /api/v1/auth/login', () => {
  test('returns 401 with invalid credentials (user not found)', async () => {
    // Mock: no user found
    MockUser.findOne.mockReturnValue(chainableQuery(null));

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'nobody@example.com',
      password: 'whatever',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  test('returns 401 with invalid credentials (wrong password)', async () => {
    const mockUser = makeMockUser({ email: 'test@example.com' });
    mockUser.comparePassword.mockResolvedValue(false);
    MockUser.findOne.mockReturnValue(chainableQuery(mockUser));

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'test@example.com',
      password: 'wrong-password',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  test('returns 200 + token on valid credentials', async () => {
    const mockUser = makeMockUser({ email: 'test@example.com' });
    mockUser.comparePassword.mockResolvedValue(true);
    MockUser.findOne.mockReturnValue(chainableQuery(mockUser));

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'test@example.com',
      password: 'correct-password',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body).toHaveProperty('refreshToken');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body).toHaveProperty('user');
  });

  test('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      password: 'whatever',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when password is missing', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'test@example.com',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 403 when the account is suspended', async () => {
    const mockUser = makeMockUser({ email: 'suspended@example.com', isSuspended: true });
    MockUser.findOne.mockReturnValue(chainableQuery(mockUser));

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'suspended@example.com',
      password: 'whatever',
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

describe('Auth routes — POST /api/v1/auth/refresh', () => {
  test('returns 400 when no refreshToken is provided in the body', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 401 when the refreshToken is invalid (not a valid JWT)', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: 'not.a.real.jwt',
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid|expired/i);
  });

  test('returns 401 when the refreshToken was signed with the wrong secret', async () => {
    const badToken = jwt.sign(
      { userId: '507f1f77bcf86cd799439011', type: 'refresh' },
      'wrong-secret',
      { expiresIn: '1h' },
    );
    const res = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: badToken,
    });
    expect(res.status).toBe(401);
  });
});

describe('Auth routes — GET /api/v1/auth/verify', () => {
  test('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/v1/auth/verify');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/token/i);
  });

  test('returns 401 with a malformed Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/verify')
      .set('Authorization', 'Bearer malformed.token.here');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 with the user when a valid token is sent', async () => {
    const mockUser = makeMockUser();
    MockUser.findById.mockReturnValue(chainableQuery(mockUser));

    const validToken = jwt.sign(
      { userId: '507f1f77bcf86cd799439011', role: 'fleet_manager' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' },
    );

    const res = await request(app)
      .get('/api/v1/auth/verify')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('user');
  });
});

describe('Auth routes — full register → login → verify cycle', () => {
  test('a freshly registered user can immediately login and verify', async () => {
    // Step 1: Register
    MockUser.findOne.mockReturnValue(chainableQuery(null));
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Cycle User',
      email: 'cycle@example.com',
      password: 'CyclePassword123',
      role: 'super_admin',
    });
    expect(regRes.status).toBe(201);
    const token = regRes.body.token;
    expect(token).toBeTruthy();

    // Step 2: Verify the token (proves it was signed with the correct secret)
    const mockUser = makeMockUser({ email: 'cycle@example.com', name: 'Cycle User' });
    MockUser.findById.mockReturnValue(chainableQuery(mockUser));
    const verRes = await request(app)
      .get('/api/v1/auth/verify')
      .set('Authorization', `Bearer ${token}`);
    expect(verRes.status).toBe(200);
    expect(verRes.body.success).toBe(true);

    // Step 3: Login (mock that the user now exists with a matching password)
    const loginUser = makeMockUser({ email: 'cycle@example.com', name: 'Cycle User' });
    loginUser.comparePassword.mockResolvedValue(true);
    MockUser.findOne.mockReturnValue(chainableQuery(loginUser));
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'cycle@example.com',
      password: 'CyclePassword123',
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();
    expect(loginRes.body.token).not.toBe(token); // new token after login

    // Step 4: Verify the login token
    MockUser.findById.mockReturnValue(chainableQuery(loginUser));
    const ver2Res = await request(app)
      .get('/api/v1/auth/verify')
      .set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(ver2Res.status).toBe(200);
  });
});

describe('Auth routes — logout (best-effort)', () => {
  test('POST /logout returns 200 even with no token', async () => {
    const res = await request(app).post('/api/v1/auth/logout').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /logout returns 200 when a refresh token is provided (best-effort revoke)', async () => {
    const refreshToken = jwt.sign(
      { userId: '507f1f77bcf86cd799439011', family: 'fam-1', type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '30d' },
    );
    const mockUser = makeMockUser();
    MockUser.findById.mockReturnValue(chainableQuery(mockUser));

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Auth routes — POST /api/v1/auth/logout-all', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).post('/api/v1/auth/logout-all');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 200 and revokes all sessions when a valid token is provided', async () => {
    const mockUser = makeMockUser();
    MockUser.findById.mockReturnValue(chainableQuery(mockUser));

    const token = jwt.sign(
      { userId: '507f1f77bcf86cd799439011', role: 'fleet_manager' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' },
    );

    const res = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockUser.revokeAllRefreshTokens).toHaveBeenCalled();
  });

  test('returns 404 when the user no longer exists', async () => {
    MockUser.findById.mockReturnValue(chainableQuery(null));

    const token = jwt.sign(
      { userId: '507f1f77bcf86cd799439011', role: 'fleet_manager' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' },
    );

    const res = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('Auth routes — GET /api/v1/auth/sessions', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/auth/sessions');
    expect(res.status).toBe(401);
  });

  test('returns 200 with active sessions list', async () => {
    const mockUser = makeMockUser();
    mockUser.refreshTokens = [
      {
        deviceName: 'Chrome',
        deviceType: 'web',
        ipAddress: '127.0.0.1',
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        family: 'fam-1',
        revokedAt: null,
      },
    ];
    MockUser.findById.mockReturnValue(chainableQuery(mockUser));

    const token = jwt.sign(
      { userId: '507f1f77bcf86cd799439011', role: 'fleet_manager' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' },
    );

    const res = await request(app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.sessions)).toBe(true);
  });
});

describe('Auth routes — POST /api/v1/auth/change-password', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).post('/api/v1/auth/change-password');
    expect(res.status).toBe(401);
  });

  test('returns 400 when currentPassword or newPassword is missing', async () => {
    const mockUser = makeMockUser();
    MockUser.findById.mockReturnValue(chainableQuery(mockUser));

    const token = jwt.sign(
      { userId: '507f1f77bcf86cd799439011', role: 'fleet_manager' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' },
    );

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('returns 400 when newPassword is shorter than 8 characters', async () => {
    const mockUser = makeMockUser();
    MockUser.findById.mockReturnValue(chainableQuery(mockUser));

    const token = jwt.sign(
      { userId: '507f1f77bcf86cd799439011', role: 'fleet_manager' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' },
    );

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'oldpass123', newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  test('returns 401 when currentPassword is incorrect', async () => {
    const mockUser = makeMockUser();
    mockUser.comparePassword.mockResolvedValue(false);
    MockUser.findById.mockReturnValue(chainableQuery(mockUser));

    const token = jwt.sign(
      { userId: '507f1f77bcf86cd799439011', role: 'fleet_manager' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' },
    );

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrong-old-pass', newPassword: 'NewValidPass123' });
    expect(res.status).toBe(401);
  });

  test('returns 200 when the password is successfully changed', async () => {
    const mockUser = makeMockUser();
    mockUser.comparePassword.mockResolvedValue(true);
    mockUser.passwordHistory = [];
    MockUser.findById.mockReturnValue(chainableQuery(mockUser));

    const token = jwt.sign(
      { userId: '507f1f77bcf86cd799439011', role: 'fleet_manager' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' },
    );

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'OldValidPass123', newPassword: 'NewValidPass123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockUser.revokeAllRefreshTokens).toHaveBeenCalled();
  });
});

describe('Auth routes — POST /api/v1/auth/password-reset/request', () => {
  test('returns 200 (does not leak whether email exists)', async () => {
    MockUser.findOne.mockReturnValue(chainableQuery(null));
    const res = await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 200 when the email exists (sends reset link internally)', async () => {
    const mockUser = makeMockUser({ email: 'exists@example.com' });
    MockUser.findOne.mockReturnValue(chainableQuery(mockUser));
    const res = await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'exists@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 200 for any input (does not leak email existence — no validation check)', async () => {
    // NOTE: the route registers body('email').isEmail() but does NOT call
    // validationResult(), so invalid emails are accepted silently. The
    // route still returns 200 to avoid leaking which emails are registered.
    MockUser.findOne.mockReturnValue(chainableQuery(null));
    const res = await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
