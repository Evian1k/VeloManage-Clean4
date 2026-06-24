/**
 * Integration tests for cross-cutting security middleware:
 *   - authenticateToken rejects missing / malformed tokens with 401
 *   - express-rate-limit returns 429 after the configured max
 *   - helmet sets standard security headers
 *   - CORS preflight (OPTIONS) is handled
 *
 * No model mocking required — these tests exercise middleware that runs
 * BEFORE any DB-touching route handler.
 */
import { describe, test, expect, beforeAll } from '@jest/globals';

import { createApp } from '../helpers/app.js';

let request;
let app;

beforeAll(async () => {
  const supertestModule = await import('supertest');
  request = supertestModule.default;
  // Use a generous rate limit so the cross-cutting tests don't accidentally
  // trip it. The dedicated rate-limit tests below use their own low-limit apps.
  app = createApp({
    rateLimitMax: 1000,
    rateLimitWindowMs: 60 * 1000,
  });
});

describe('Security middleware — protected routes', () => {
  test('return 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/v1/vehicles');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.message).toMatch(/token|denied/i);
  });

  test('return 401 when Authorization header has no Bearer prefix', async () => {
    const res = await request(app)
      .get('/api/v1/vehicles')
      .set('Authorization', 'just-a-string');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('success', false);
  });

  test('return 401 with a malformed (non-JWT) Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/vehicles')
      .set('Authorization', 'Bearer not.a.real.jwt');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.message).toMatch(/token|invalid/i);
  });

  test('return 401 when the JWT signature is wrong (signed with a different secret)', async () => {
    // Sign with the wrong secret — jwt.verify will throw JsonWebTokenError
    const jwt = (await import('jsonwebtoken')).default;
    const badToken = jwt.sign(
      { userId: '507f1f77bcf86cd799439011', role: 'fleet_manager' },
      'wrong-secret',
      { expiresIn: '15m' },
    );
    const res = await request(app)
      .get('/api/v1/vehicles')
      .set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('success', false);
  });

  test('return 401 when the JWT has expired', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const expired = jwt.sign(
      { userId: '507f1f77bcf86cd799439011', role: 'fleet_manager' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }, // already expired
    );
    const res = await request(app)
      .get('/api/v1/vehicles')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('success', false);
  });
});

describe('Security middleware — rate limiting', () => {
  // Use a fresh app with a low limit so we can trigger 429 in a few calls
  test('returns 429 after the configured max requests is exceeded', async () => {
    const tinyApp = createApp({ rateLimitMax: 3, rateLimitWindowMs: 60 * 1000 });
    const supertest = (await import('supertest')).default;

    // Hit a non-existent /api/* route — the rate limiter runs before the 404
    // handler, so the first 3 requests get 404 and the rest get 429.
    const statuses = [];
    for (let i = 0; i < 5; i++) {
      const res = await supertest(tinyApp).get('/api/v1/nonexistent-route');
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 3)).toEqual([404, 404, 404]);
    expect(statuses.slice(3)).toEqual([429, 429]);
  });

  test('rate-limit response includes a Retry-After hint', async () => {
    const tinyApp = createApp({ rateLimitMax: 1, rateLimitWindowMs: 60 * 1000 });
    const supertest = (await import('supertest')).default;

    await supertest(tinyApp).get('/api/v1/anything'); // consumes the 1 allowed
    const res = await supertest(tinyApp).get('/api/v1/anything'); // this one is limited
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toMatch(/too many/i);
    // express-rate-limit sets RateLimit-Reset (standard header)
    expect(res.headers['ratelimit-reset']).toBeDefined();
  });
});

describe('Security middleware — helmet headers', () => {
  test('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('sets X-Frame-Options (clickjacking protection)', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  test('sets Strict-Transport-Security (HSTS)', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  test('sets X-DNS-Prefetch-Control', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-dns-prefetch-control']).toBeDefined();
  });

  test('sets X-Download-Options', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-download-options']).toBeDefined();
  });

  test('sets Content-Security-Policy', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});

describe('Security middleware — CORS preflight (OPTIONS)', () => {
  test('responds to OPTIONS with appropriate CORS headers', async () => {
    const res = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type, Authorization');

    // CORS preflight should return 2xx (204 No Content is typical)
    expect(res.status).toBeLessThan(400);

    // Access-Control-Allow-Origin echoes the requesting origin (or *)
    expect(res.headers['access-control-allow-origin']).toBeDefined();

    // Allowed methods include POST
    expect(res.headers['access-control-allow-methods']).toBeDefined();
    expect(res.headers['access-control-allow-methods']).toMatch(/POST/);

    // Allowed headers include Authorization
    expect(res.headers['access-control-allow-headers']).toBeDefined();
    expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
  });

  test('reflects the requesting origin (credentials mode)', async () => {
    const origin = 'http://localhost:5173';
    const res = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});

describe('Security middleware — unknown routes', () => {
  test('return 404 for non-existent routes with a helpful message', async () => {
    const res = await request(app).get('/api/v1/this-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error', 'Route not found');
    expect(res.body.message).toMatch(/does not exist/i);
  });
});
