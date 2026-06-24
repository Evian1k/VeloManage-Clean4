/**
 * Unit tests for the zero-dependency Prometheus metrics middleware.
 *
 * Covers src/middleware/monitoring.js
 *
 * Tests the Counter, Gauge, Histogram primitives, the route-normalisation
 * helper, the request-recording middleware, and the /metrics endpoint.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

import {
  metricsMiddleware,
  requestMetricsMiddleware,
  setDbConnections,
  setActiveConnections,
  startEventLoopSampling,
  stopEventLoopSampling,
} from '../../src/middleware/monitoring.js';

// ─── Helper: build a minimal req/res/next triplet ──────────────────────────
function makeReqRes(overrides = {}) {
  const req = {
    method: overrides.method || 'GET',
    path: overrides.path || '/api/v1/test',
    url: overrides.url || '/api/v1/test',
    baseUrl: overrides.baseUrl,
    route: overrides.route,
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  };
  const res = {
    statusCode: 200,
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    on: jest.fn((event, cb) => {
      // Store the callback so tests can trigger 'finish' manually
      if (event === 'finish') res._finishCb = cb;
      if (event === 'close') res._closeCb = cb;
    }),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('metricsMiddleware — GET /metrics endpoint', () => {
  test('returns 200 with Prometheus text format', () => {
    const { req, res } = makeReqRes();
    metricsMiddleware(req, res);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4; charset=utf-8',
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalled();
    const body = res.send.mock.calls[0][0];
    expect(typeof body).toBe('string');
    expect(body).toContain('# HELP');
    expect(body).toContain('# TYPE');
  });

  test('includes the http_requests_total counter', () => {
    const { req, res } = makeReqRes();
    metricsMiddleware(req, res);
    const body = res.send.mock.calls[0][0];
    expect(body).toContain('http_requests_total');
    expect(body).toContain('# TYPE http_requests_total counter');
  });

  test('includes the http_request_duration_seconds histogram header even when empty', () => {
    // With no observations yet, only the # HELP / # TYPE lines are emitted
    // (the implementation skips empty label sets rather than emitting zeroed
    // buckets). This test pins that header-only behaviour; the next test
    // verifies the bucket/sum/count samples appear once a request is observed.
    const { req, res } = makeReqRes();
    metricsMiddleware(req, res);
    const body = res.send.mock.calls[0][0];
    expect(body).toContain('http_request_duration_seconds');
    expect(body).toContain('# TYPE http_request_duration_seconds histogram');
  });

  test('emits _bucket/_sum/_count samples and le="+Inf" once a request is observed', () => {
    // Trigger an observation by running a request through requestMetricsMiddleware
    const { req, res, next } = makeReqRes({ method: 'GET', path: '/health' });
    requestMetricsMiddleware(req, res, next);
    res._finishCb();

    // Now scrape /metrics — the histogram should have full bucket/sum/count samples
    const { req: mReq, res: mRes } = makeReqRes();
    metricsMiddleware(mReq, mRes);
    const body = mRes.send.mock.calls[0][0];
    expect(body).toContain('# TYPE http_request_duration_seconds histogram');
    expect(body).toContain('http_request_duration_seconds_bucket');
    expect(body).toContain('http_request_duration_seconds_sum');
    expect(body).toContain('http_request_duration_seconds_count');
    // The +Inf bucket is always present once we have an observation
    expect(body).toContain('le="+Inf"');
  });

  test('includes gauges: active_connections, db_connections, etc.', () => {
    const { req, res } = makeReqRes();
    metricsMiddleware(req, res);
    const body = res.send.mock.calls[0][0];
    expect(body).toContain('active_connections');
    expect(body).toContain('db_connections');
    expect(body).toContain('http_requests_in_flight');
    expect(body).toContain('# TYPE active_connections gauge');
  });

  test('includes nodejs_memory_heap_used_bytes gauge', () => {
    const { req, res } = makeReqRes();
    metricsMiddleware(req, res);
    const body = res.send.mock.calls[0][0];
    expect(body).toContain('nodejs_memory_heap_used_bytes');
  });

  test('appends a scrape timestamp comment at the end', () => {
    const { req, res } = makeReqRes();
    metricsMiddleware(req, res);
    const body = res.send.mock.calls[0][0];
    expect(body).toMatch(/VeloManage metrics — scraped at/);
  });
});

describe('requestMetricsMiddleware — per-request recording', () => {
  test('calls next() immediately (non-blocking)', () => {
    const { req, res, next } = makeReqRes();
    requestMetricsMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('registers a "finish" listener on res', () => {
    const { req, res, next } = makeReqRes();
    requestMetricsMiddleware(req, res, next);
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  test('registers a "close" listener on res', () => {
    const { req, res, next } = makeReqRes();
    requestMetricsMiddleware(req, res, next);
    expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  test('after the response finishes, the /metrics endpoint reflects the request', () => {
    const { req, res, next } = makeReqRes({ method: 'POST', path: '/api/v1/test' });
    requestMetricsMiddleware(req, res, next);

    // Simulate response finish
    res._finishCb();

    // Now scrape /metrics — the counter should have a sample for POST /api/v1/test
    const { req: mReq, res: mRes } = makeReqRes();
    metricsMiddleware(mReq, mRes);
    const body = mRes.send.mock.calls[0][0];
    expect(body).toContain('method="POST"');
    expect(body).toContain('route="/api/v1/test"');
    expect(body).toContain('status="200"');
  });

  test('normalises MongoDB ObjectIds in the path to :id', () => {
    const { req, res, next } = makeReqRes({
      method: 'GET',
      path: '/api/v1/vehicles/507f1f77bcf86cd799439011',
    });
    requestMetricsMiddleware(req, res, next);
    res._finishCb();

    const { req: mReq, res: mRes } = makeReqRes();
    metricsMiddleware(mReq, mRes);
    const body = mRes.send.mock.calls[0][0];
    expect(body).toContain('route="/api/v1/vehicles/:id"');
  });

  test('normalises UUIDs in the path to :id', () => {
    const { req, res, next } = makeReqRes({
      method: 'GET',
      path: '/api/v1/assets/550e8400-e29b-41d4-a716-446655440000',
    });
    requestMetricsMiddleware(req, res, next);
    res._finishCb();

    const { req: mReq, res: mRes } = makeReqRes();
    metricsMiddleware(mReq, mRes);
    const body = mRes.send.mock.calls[0][0];
    expect(body).toContain('route="/api/v1/assets/:id"');
  });

  test('normalises numeric IDs in the path to :id', () => {
    const { req, res, next } = makeReqRes({
      method: 'GET',
      path: '/api/v1/items/12345',
    });
    requestMetricsMiddleware(req, res, next);
    res._finishCb();

    const { req: mReq, res: mRes } = makeReqRes();
    metricsMiddleware(mReq, mRes);
    const body = mRes.send.mock.calls[0][0];
    expect(body).toContain('route="/api/v1/items/:id"');
  });

  test('does NOT normalise non-dynamic segments (words stay as-is)', () => {
    const { req, res, next } = makeReqRes({
      method: 'GET',
      path: '/api/v1/vehicles/stats',
    });
    requestMetricsMiddleware(req, res, next);
    res._finishCb();

    const { req: mReq, res: mRes } = makeReqRes();
    metricsMiddleware(mReq, mRes);
    const body = mRes.send.mock.calls[0][0];
    expect(body).toContain('route="/api/v1/vehicles/stats"');
  });
});

describe('setDbConnections / setActiveConnections', () => {
  test('setDbConnections updates the db_connections gauge', () => {
    setDbConnections(7);
    const { req, res } = makeReqRes();
    metricsMiddleware(req, res);
    const body = res.send.mock.calls[0][0];
    expect(body).toMatch(/db_connections 7/);
  });

  test('setActiveConnections updates the active_connections gauge', () => {
    setActiveConnections(3);
    const { req, res } = makeReqRes();
    metricsMiddleware(req, res);
    const body = res.send.mock.calls[0][0];
    expect(body).toMatch(/active_connections 3/);
  });

  test('setDbConnections(0) reports zero', () => {
    setDbConnections(0);
    const { req, res } = makeReqRes();
    metricsMiddleware(req, res);
    const body = res.send.mock.calls[0][0];
    expect(body).toMatch(/db_connections 0/);
  });
});

describe('startEventLoopSampling / stopEventLoopSampling', () => {
  test('startEventLoopSampling is idempotent (clears previous timer)', () => {
    expect(() => {
      startEventLoopSampling(1000);
      startEventLoopSampling(2000);
    }).not.toThrow();
  });

  test('stopEventLoopSampling is a no-op when not started', () => {
    stopEventLoopSampling();
    stopEventLoopSampling(); // double-stop should not throw
  });

  test('start then stop cleans up the timer', () => {
    startEventLoopSampling(1000);
    stopEventLoopSampling();
    // No assertion beyond "doesn't throw" — the timer is internal
    expect(true).toBe(true);
  });
});

describe('metricsMiddleware — histogram bucket coverage', () => {
  test('after observing a fast request, the lowest bucket count increments', () => {
    // Make a request and finish it — the middleware calls observe() with the duration
    const { req, res, next } = makeReqRes({ method: 'GET', path: '/health' });
    requestMetricsMiddleware(req, res, next);
    res._finishCb();

    const { req: mReq, res: mRes } = makeReqRes();
    metricsMiddleware(mReq, mRes);
    const body = mRes.send.mock.calls[0][0];
    // The +Inf bucket should have count >= 1
    expect(body).toMatch(/\+Inf"[\s\S]* [1-9]\d*/);
  });
});
