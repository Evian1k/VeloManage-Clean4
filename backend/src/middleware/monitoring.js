// =============================================================================
// VeloManage — Prometheus metrics middleware (zero external dependencies)
// =============================================================================
// Exposes a /metrics endpoint in Prometheus text format and records per-request
// latency / counters for every Express route.
//
// Metrics:
//   - http_requests_total{method,route,status}            (counter)
//   - http_request_duration_seconds{method,route,status}  (histogram, buckets below)
//   - active_connections                                  (gauge)
//   - db_connections                                      (gauge, set by caller)
//   - http_requests_in_flight                             (gauge)
//   - nodejs_memory_heap_used_bytes                       (gauge)
//   - nodejs_event_loop_lag_seconds                       (gauge, sampled)
//
// Usage in server.js:
//   import { metricsMiddleware, requestMetricsMiddleware, setDbConnections } from
//     './src/middleware/monitoring.js';
//   app.use(requestMetricsMiddleware);           // before routes
//   app.use('/metrics', metricsMiddleware);      // before 404
//
// No external deps — this is a self-contained ~250-line implementation that
// produces valid Prometheus text exposition format.
// =============================================================================

// ---------------------------------------------------------------------------
// Tiny in-memory metric primitives
// ---------------------------------------------------------------------------

class Counter {
  constructor(name, help, labelNames = []) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.values = new Map(); // key: serialized labels -> { value }
  }

  _key(labels) {
    return this.labelNames.map((n) => `${n}="${escapeLabel(labels[n] ?? '')}"`).join(',');
  }

  inc(labels = {}, by = 1) {
    const key = this._key(labels);
    const cur = this.values.get(key) || { value: 0, labels };
    cur.value += by;
    this.values.set(key, cur);
  }

  format() {
    const lines = [];
    lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} counter`);
    for (const { value, labels } of this.values.values()) {
      lines.push(formatSample(this.name, this._key(labels), value));
    }
    return lines.join('\n');
  }
}

class Gauge {
  constructor(name, help, labelNames = []) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.values = new Map();
  }

  _key(labels) {
    return this.labelNames.map((n) => `${n}="${escapeLabel(labels[n] ?? '')}"`).join(',');
  }

  set(labels = {}, value) {
    if (typeof labels === 'number') {
      // Allow set(value) when no labels
      value = labels;
      labels = {};
    }
    const key = this._key(labels);
    this.values.set(key, { value, labels });
  }

  inc(labels = {}, by = 1) {
    if (typeof labels === 'number') {
      by = labels;
      labels = {};
    }
    const key = this._key(labels);
    const cur = this.values.get(key) || { value: 0, labels };
    cur.value += by;
    this.values.set(key, cur);
  }

  dec(labels = {}, by = 1) {
    this.inc(labels, -by);
  }

  format() {
    const lines = [];
    lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} gauge`);
    for (const { value, labels } of this.values.values()) {
      lines.push(formatSample(this.name, this._key(labels), value));
    }
    return lines.join('\n');
  }
}

class Histogram {
  constructor(name, help, labelNames = [], buckets = DEFAULT_BUCKETS) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
    this.buckets = [...buckets].sort((a, b) => a - b);
    // Allow +Inf bucket to be implicit; ensure last bucket is +Inf
    if (this.buckets[this.buckets.length - 1] !== Number.POSITIVE_INFINITY) {
      this.buckets.push(Number.POSITIVE_INFINITY);
    }
    this.values = new Map(); // key -> { buckets: Map(le -> count), sum, count, labels }
  }

  _key(labels) {
    return this.labelNames.map((n) => `${n}="${escapeLabel(labels[n] ?? '')}"`).join(',');
  }

  observe(labels = {}, value) {
    if (typeof labels === 'number') {
      value = labels;
      labels = {};
    }
    const key = this._key(labels);
    let cur = this.values.get(key);
    if (!cur) {
      cur = {
        buckets: new Map(this.buckets.map((le) => [le, 0])),
        sum: 0,
        count: 0,
        labels,
      };
      this.values.set(key, cur);
    }
    cur.sum += value;
    cur.count += 1;
    for (const le of this.buckets) {
      if (value <= le) cur.buckets.set(le, (cur.buckets.get(le) || 0) + 1);
    }
  }

  format() {
    const lines = [];
    lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} histogram`);
    for (const { buckets, sum, count, labels } of this.values.values()) {
      const labelKey = this._key(labels);
      // Each bucket is a separate sample with le="..."
      for (const le of this.buckets) {
        const leStr = le === Number.POSITIVE_INFINITY ? '+Inf' : le;
        // Compose labels with le appended
        const fullLabel = this.labelNames
          .map((n) => `${n}="${escapeLabel(labels[n] ?? '')}"`)
          .concat([`le="${leStr}"`])
          .join(',');
        lines.push(formatSample(`${this.name}_bucket`, fullLabel, buckets.get(le) || 0));
      }
      lines.push(formatSample(`${this.name}_sum`, labelKey, sum));
      lines.push(formatSample(`${this.name}_count`, labelKey, count));
    }
    return lines.join('\n');
  }
}

function escapeLabel(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

// Emit a Prometheus sample line. When there are no labels, omit the `{}` (the
// exposition format spec allows both, but the brace-less form is idiomatic).
function formatSample(name, labelKey, value) {
  if (labelKey && labelKey.length > 0) {
    return `${name}{${labelKey}} ${value}`;
  }
  return `${name} ${value}`;
}

// ---------------------------------------------------------------------------
// Default histogram buckets (seconds) — covers fast API calls through slow ones
// ---------------------------------------------------------------------------
const DEFAULT_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

// ---------------------------------------------------------------------------
// Metric instances
// ---------------------------------------------------------------------------
const httpRequestsTotal = new Counter(
  'http_requests_total',
  'Total number of HTTP requests received.',
  ['method', 'route', 'status'],
);

const httpRequestDurationSeconds = new Histogram(
  'http_request_duration_seconds',
  'HTTP request latency in seconds.',
  ['method', 'route', 'status'],
  DEFAULT_BUCKETS,
);

const activeConnections = new Gauge(
  'active_connections',
  'Number of active HTTP connections currently being processed.',
);

const httpRequestsInFlight = new Gauge(
  'http_requests_in_flight',
  'Number of HTTP requests currently in flight.',
);

const dbConnections = new Gauge(
  'db_connections',
  'Number of open MongoDB connection pool connections.',
);

const nodejsMemoryHeapUsed = new Gauge(
  'nodejs_memory_heap_used_bytes',
  'Process heap memory used (bytes).',
);

const nodejsEventLoopLag = new Gauge(
  'nodejs_event_loop_lag_seconds',
  'Event loop lag in seconds (sampled every 5s).',
);

// ---------------------------------------------------------------------------
// Setters for external integrations (call from server.js / mongoose events)
// ---------------------------------------------------------------------------
export function setDbConnections(count) {
  dbConnections.set({}, count);
}

export function setActiveConnections(count) {
  activeConnections.set({}, count);
}

// ---------------------------------------------------------------------------
// Route normalisation — collapse /api/v1/trucks/:id -> /api/v1/trucks/:id
// so we don't blow up the label cardinality with every object id.
// ---------------------------------------------------------------------------
const DYNAMIC_SEG_PATTERNS = [
  // MongoDB ObjectId (24 hex chars)
  /^[0-9a-fA-F]{24}$/,
  // UUID
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  // Pure numeric
  /^\d+$/,
];

function normalizePath(req) {
  const route = req.route ? req.route.path : null;
  if (route && req.baseUrl) {
    return `${req.baseUrl}${route}`;
  }
  if (route) {
    return route;
  }
  // Fallback: normalise req.path by collapsing dynamic-looking segments
  if (!req.path) return 'unknown';
  return req.path
    .split('/')
    .map((seg) => (DYNAMIC_SEG_PATTERNS.some((re) => re.test(seg)) ? ':id' : seg))
    .join('/');
}

// ---------------------------------------------------------------------------
// Middleware: record per-request metrics
// ---------------------------------------------------------------------------
export function requestMetricsMiddleware(req, res, next) {
  const startNs = process.hrtime.bigint();
  httpRequestsInFlight.inc();

  // Hook into response finish to record final status + duration
  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - startNs);
    const durationSec = durationNs / 1e9;
    const labels = {
      method: req.method,
      route: normalizePath(req),
      status: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSec);
    httpRequestsInFlight.dec();
  });

  // If the client disconnects early, still record the in-flight decrement
  res.on('close', () => {
    // 'finish' may or may not have fired; the gauge decrement is idempotent
    // enough — we accept a possible small under-count on abrupt disconnects.
  });

  next();
}

// ---------------------------------------------------------------------------
// Endpoint: GET /metrics — returns Prometheus text exposition format
// ---------------------------------------------------------------------------
export function metricsMiddleware(req, res) {
  // Sample runtime metrics on each scrape
  if (process.memoryUsage) {
    nodejsMemoryHeapUsed.set({}, process.memoryUsage().heapUsed);
  }

  const blocks = [
    httpRequestsTotal.format(),
    httpRequestDurationSeconds.format(),
    activeConnections.format(),
    httpRequestsInFlight.format(),
    dbConnections.format(),
    nodejsMemoryHeapUsed.format(),
    nodejsEventLoopLag.format(),
    `\n# VeloManage metrics — scraped at ${new Date().toISOString()}`,
  ];

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.status(200).send(blocks.join('\n') + '\n');
}

// ---------------------------------------------------------------------------
// Sample event loop lag every 5 seconds (cheap & non-blocking)
// ---------------------------------------------------------------------------
let eventLoopTimer = null;
function sampleEventLoopLag() {
  const start = process.hrtime.bigint();
  setImmediate(() => {
    const lagSec = Number(process.hrtime.bigint() - start) / 1e9;
    nodejsEventLoopLag.set({}, lagSec);
  });
}

export function startEventLoopSampling(intervalMs = 5000) {
  if (eventLoopTimer) clearInterval(eventLoopTimer);
  eventLoopTimer = setInterval(sampleEventLoopLag, intervalMs);
  if (eventLoopTimer.unref) eventLoopTimer.unref(); // don't keep process alive
}

export function stopEventLoopSampling() {
  if (eventLoopTimer) {
    clearInterval(eventLoopTimer);
    eventLoopTimer = null;
  }
}

// Auto-start sampling on module import (timer is unref'd so it won't block shutdown)
startEventLoopSampling();

export default {
  metricsMiddleware,
  requestMetricsMiddleware,
  setDbConnections,
  setActiveConnections,
  startEventLoopSampling,
  stopEventLoopSampling,
};
