/**
 * Global test setup — runs once per test file before any tests execute.
 *
 * Responsibilities:
 *   1. Set safe test env vars so config defaults never hit real services
 *   2. Stub dotenv.config() so a stray .env file can't override our values
 *   3. Stub mongoose.connect so Mongoose never tries to reach a real DB
 *
 * Imported via `setupFiles` in jest.config.js.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

// ─── 1. Test environment variables ─────────────────────────────────────────
// These are set BEFORE any application code is imported, so every module
// sees the test values via process.env.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';
process.env.MONGODB_URI = 'mongodb://localhost:27017/velomanage-test';
process.env.PORT = '0'; // ephemeral port — never collide across workers
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.API_VERSION = 'v1';

// ─── 2. Stub dotenv.config() ───────────────────────────────────────────────
// server.js calls dotenv.config() at import time. In tests we never want a
// real .env file to override the values above.
dotenv.config = () => ({ parsed: {} });

// ─── 3. Stub mongoose.connect ──────────────────────────────────────────────
// Prevent any Mongoose connection attempt during tests. Models are still
// defined normally (mongoose.model(...) works without a connection); only
// actual query execution is mocked per-test via jest.unstable_mockModule.
mongoose.connect = () => Promise.resolve({});

// Mark connection as disconnected so /health and /ready report DEGRADED
// unless a test explicitly overrides this.
try {
  Object.defineProperty(mongoose.connection, 'readyState', {
    value: 0,
    writable: true,
    configurable: true,
  });
} catch {
  // Some Mongoose versions make readyState a getter — best-effort override
}

// Silence noisy console.error / console.log from application code during tests
// (comment out a line below if you need to debug a specific test)
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
console.error = (...args) => {
  // Keep Jest's own assertion failures visible
  if (typeof args[0] === 'string' && args[0].includes('Audit log write failed')) return;
  if (typeof args[0] === 'string' && args[0].includes('Register error')) return;
  if (typeof args[0] === 'string' && args[0].includes('Login error')) return;
  if (typeof args[0] === 'string' && args[0].includes('Refresh error')) return;
  originalConsoleError(...args);
};
console.log = (...args) => {
  // Suppress startup banners / socket.io logs
  if (typeof args[0] === 'string' && args[0].includes('VeloManage')) return;
  if (typeof args[0] === 'string' && args[0].includes('Socket')) return;
  if (typeof args[0] === 'string' && args[0].includes('MongoDB')) return;
  originalConsoleLog(...args);
};
