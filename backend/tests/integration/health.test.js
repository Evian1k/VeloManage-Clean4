/**
 * Integration tests for the health / readiness / root endpoints.
 *
 * No mocking required — these endpoints only touch `mongoose.connection.readyState`
 * (set to 0 = disconnected in tests/setup.js) and process metadata.
 *
 * Covers: GET /health, GET /ready, GET /
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';

import { createApp } from '../helpers/app.js';

let request;
let app;

beforeAll(async () => {
  // Dynamic import so supertest loads AFTER setup.js has run
  const supertestModule = await import('supertest');
  request = supertestModule.default;
  app = createApp();
});

describe('Health & readiness endpoints', () => {
  describe('GET /health', () => {
    test('returns 200 with a `status` field when DB is connected', async () => {
      // Temporarily simulate a connected DB
      const original = mongoose.connection.readyState;
      try {
        Object.defineProperty(mongoose.connection, 'readyState', {
          value: 1, writable: true, configurable: true,
        });
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('status');
        expect(res.body.status).toBe('OK');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body).toHaveProperty('database');
        expect(res.body.database.connected).toBe(true);
        expect(res.body.database.state).toBe('connected');
      } finally {
        Object.defineProperty(mongoose.connection, 'readyState', {
          value: original, writable: true, configurable: true,
        });
      }
    });

    test('returns 503 with status DEGRADED when DB is disconnected', async () => {
      const original = mongoose.connection.readyState;
      try {
        Object.defineProperty(mongoose.connection, 'readyState', {
          value: 0, writable: true, configurable: true,
        });
        const res = await request(app).get('/health');
        expect(res.status).toBe(503);
        expect(res.body.status).toBe('DEGRADED');
        expect(res.body.database.connected).toBe(false);
        expect(res.body.database.state).toBe('disconnected');
      } finally {
        Object.defineProperty(mongoose.connection, 'readyState', {
          value: original, writable: true, configurable: true,
        });
      }
    });

    test('includes uptime, environment, and version fields', async () => {
      const res = await request(app).get('/health');
      expect(res.body).toHaveProperty('uptime');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body).toHaveProperty('environment');
      expect(res.body).toHaveProperty('version');
    });
  });

  describe('GET /ready', () => {
    test('returns 503 when DB is disconnected (setup.js default)', async () => {
      const original = mongoose.connection.readyState;
      try {
        Object.defineProperty(mongoose.connection, 'readyState', {
          value: 0, writable: true, configurable: true,
        });
        const res = await request(app).get('/ready');
        expect(res.status).toBe(503);
        expect(res.body).toHaveProperty('ready', false);
      } finally {
        Object.defineProperty(mongoose.connection, 'readyState', {
          value: original, writable: true, configurable: true,
        });
      }
    });

    test('returns 200 when DB is connected', async () => {
      const original = mongoose.connection.readyState;
      try {
        Object.defineProperty(mongoose.connection, 'readyState', {
          value: 1, writable: true, configurable: true,
        });
        const res = await request(app).get('/ready');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('ready', true);
      } finally {
        Object.defineProperty(mongoose.connection, 'readyState', {
          value: original, writable: true, configurable: true,
        });
      }
    });
  });

  describe('GET / (root)', () => {
    test('returns 200 with an endpoints list', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name');
      expect(res.body.name).toBe('VeloManage API');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('endpoints');
      expect(res.body.endpoints).toHaveProperty('health');
      expect(res.body.endpoints).toHaveProperty('ready');
      expect(res.body.endpoints).toHaveProperty('auth');
      expect(res.body.endpoints).toHaveProperty('vehicles');
    });

    test('reports the test environment', async () => {
      const res = await request(app).get('/');
      expect(res.body.environment).toBe('test');
    });
  });
});
