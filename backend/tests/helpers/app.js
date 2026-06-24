/**
 * Test app builder — constructs an Express app identical to server.js's
 * configuration but WITHOUT the side effects that make server.js hard to
 * test:
 *   - No `server.listen()` (supertest creates its own ephemeral server)
 *   - No `mongoose.connect()` (tests stub this in tests/setup.js)
 *   - No Socket.io `Server` (routes that need io get a mock)
 *
 * Routes are mounted exactly as in server.js so integration tests exercise
 * the real route definitions, real middleware pipeline, and real error
 * handler. Per-test mocks are applied via `jest.unstable_mockModule()` in
 * each test file BEFORE this helper is dynamically imported.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

// Routes
import authRoutes from '../../src/routes/auth.js';
import vehicleRoutes from '../../src/routes/modules/vehicles.js';

// Middleware
import { authenticateToken } from '../../src/middleware/auth.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { attachTenant } from '../../src/middleware/tenant.js';

/**
 * Build an Express application suitable for supertest.
 *
 * @param {object} opts
 * @param {number} [opts.rateLimitMax=100]    - max requests per window
 * @param {number} [opts.rateLimitWindowMs=60000] - window length in ms
 * @param {string[]} [opts.allowedOrigins]    - CORS origins (defaults to permissive)
 * @returns {import('express').Express}
 */
export function createApp(opts = {}) {
  const app = express();

  // ─── Security & parsing middleware (mirrors server.js) ──────────────────
  app.use(helmet());
  app.use(cors({
    origin: opts.allowedOrigins || (
      (origin, callback) => {
        // Permissive in tests — allows same-origin / no-origin / any origin
        if (!origin || true) return callback(null, true);
      }
    ),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  // Rate limiting — configurable so security.test.js can test the limiter
  const limiter = rateLimit({
    windowMs: opts.rateLimitWindowMs || 60 * 1000,
    max: opts.rateLimitMax || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many requests from this IP, please try again later.',
    },
  });
  app.use('/api/', limiter);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Trust first proxy (needed for correct req.ip / rate limit keys)
  app.set('trust proxy', 1);

  // ─── Health & readiness endpoints (mirror server.js exactly) ────────────
  app.get('/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    const healthy = dbState === 1;
    return res.status(healthy ? 200 : 503).json({
      status: healthy ? 'OK' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.API_VERSION || 'v1',
      uptime: process.uptime(),
      database: {
        state: dbStatusMap[dbState] || 'unknown',
        connected: healthy,
      },
    });
  });

  app.get('/ready', (req, res) => {
    if (mongoose.connection.readyState === 1) {
      return res.status(200).json({ ready: true });
    }
    return res.status(503).json({ ready: false });
  });

  app.get('/', (req, res) => {
    const apiBase = '/api/v1';
    res.json({
      name: 'VeloManage API',
      version: '2.0.0',
      environment: process.env.NODE_ENV,
      endpoints: {
        health: '/health',
        ready: '/ready',
        auth: `${apiBase}/auth`,
        vehicles: `${apiBase}/vehicles`,
      },
    });
  });

  // ─── API Routes (mirror server.js mount points) ─────────────────────────
  const apiBase = '/api/v1';

  // Public auth routes
  app.use(`${apiBase}/auth`, authRoutes);

  // Authenticated + tenant-scoped routes
  app.use(`${apiBase}/vehicles`, authenticateToken, attachTenant, vehicleRoutes);

  // ─── 404 handler ─────────────────────────────────────────────────────────
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
      message: `The requested route ${req.method} ${req.originalUrl} does not exist.`,
    });
  });

  // ─── Global error handler ────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
