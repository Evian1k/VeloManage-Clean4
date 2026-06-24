import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';

// Import routes
import authRoutes from './src/routes/auth.js';
import userRoutes from './src/routes/users.js';
import serviceRoutes from './src/routes/services.js';
import truckRoutes from './src/routes/trucks.js';
import messageRoutes from './src/routes/messages.js';
import pickupRoutes from './src/routes/pickups.js';
import branchRoutes from './src/routes/branches.js';
import bookingRoutes from './src/routes/bookings.js';
import analyticsRoutes from './src/routes/analytics.js';
import dashboardRoutes from './src/routes/dashboard.js';
import locationRoutes from './src/routes/locations.js';

// Import middleware
import { authenticateToken } from './src/middleware/auth.js';
import { errorHandler } from './src/middleware/errorHandler.js';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// ---------------------------------------------------------------------------
// Configuration (with safe defaults)
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 10000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const API_VERSION = process.env.API_VERSION || 'v1';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-fallback-secret-change-me';

// CORS origins — accept comma-separated list from env, fall back to known dev origins
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  frontendUrl,
  ...(process.env.ADDITIONAL_CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
].filter((v, i, arr) => arr.indexOf(v) === i); // dedupe

// ---------------------------------------------------------------------------
// MongoDB connection — resilient, with exponential backoff retry
// ---------------------------------------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI;
let mongoConnectionAttempts = 0;
let isShuttingDown = false;

function buildMongoOptions() {
  return {
    serverSelectionTimeoutMS: 30000, // wait up to 30s for primary
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
    maxPoolSize: 10,
    minPoolSize: 1,
    retryWrites: true,
    retryReads: true,
  };
}

async function connectMongo() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set. Server will run but DB features will fail.');
    return;
  }

  if (isShuttingDown) return;

  try {
    mongoConnectionAttempts += 1;
    console.log(`🔌 Connecting to MongoDB (attempt ${mongoConnectionAttempts})...`);
    await mongoose.connect(MONGODB_URI, buildMongoOptions());
    mongoConnectionAttempts = 0;
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error(`❌ MongoDB connection failed (attempt ${mongoConnectionAttempts}):`, error.message);

    // Common Atlas IP-whitelist error — give the user actionable guidance
    if (error.name === 'MongooseServerSelectionError' || /whitelist/i.test(error.message)) {
      console.error('');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('⚠️  ATLAS IP ACCESS LIST ISSUE (most common cause)');
      console.error('   Go to MongoDB Atlas → Network Access → Add IP Address');
      console.error('   Either:');
      console.error('     • Add 0.0.0.0/0  (allow from anywhere — fine with strong DB password)');
      console.error('     • Or add Render\'s static outbound IP (Render → Settings → Outbound IPs)');
      console.error('   Docs: https://www.mongodb.com/docs/atlas/security-whitelist/');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('');
    }

    // Exponential backoff: 2s, 4s, 8s, 16s, capped at 30s
    const delay = Math.min(30000, 2000 * Math.pow(2, Math.min(mongoConnectionAttempts - 1, 5)));
    console.log(`⏳ Retrying in ${Math.round(delay / 1000)}s...`);
    setTimeout(connectMongo, delay);
  }
}

// React to connection events so we know about drops/reconnects in logs
mongoose.connection.on('disconnected', () => {
  if (!isShuttingDown) {
    console.warn('⚠️  MongoDB disconnected. Will attempt to reconnect automatically.');
  }
});
mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected.');
});
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error event:', err.message);
});

// Kick off the initial connection (non-blocking — server starts regardless)
connectMongo();

// ---------------------------------------------------------------------------
// Security & parsing middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // allow same-origin / no-origin (curl, server-to-server, mobile)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
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

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Trust first proxy (Render runs behind one) — needed for correct req.ip / rate limit keys
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Health & readiness endpoints (must come BEFORE route registration so they
// are never shadowed by a 404 catch-all)
// ---------------------------------------------------------------------------
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const dbStatusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const healthy = dbState === 1;
  return res.status(healthy ? 200 : 503).json({
    status: healthy ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: API_VERSION,
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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'VeloManage API',
    version: '1.0.0',
    environment: NODE_ENV,
    endpoints: {
      health: '/health',
      ready: '/ready',
      auth: `/api/${API_VERSION}/auth`,
      users: `/api/${API_VERSION}/users`,
      services: `/api/${API_VERSION}/services`,
      trucks: `/api/${API_VERSION}/trucks`,
      messages: `/api/${API_VERSION}/messages`,
      pickups: `/api/${API_VERSION}/pickups`,
      branches: `/api/${API_VERSION}/branches`,
      bookings: `/api/${API_VERSION}/bookings`,
      analytics: `/api/${API_VERSION}/analytics`,
      dashboard: `/api/${API_VERSION}/dashboard`,
      locations: `/api/${API_VERSION}/locations`,
    },
  });
});

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/users`, authenticateToken, userRoutes);
app.use(`/api/${API_VERSION}/services`, authenticateToken, serviceRoutes);
app.use(`/api/${API_VERSION}/trucks`, authenticateToken, truckRoutes);
app.use(`/api/${API_VERSION}/messages`, authenticateToken, messageRoutes);
app.use(`/api/${API_VERSION}/pickups`, authenticateToken, pickupRoutes);
app.use(`/api/${API_VERSION}/branches`, authenticateToken, branchRoutes);
app.use(`/api/${API_VERSION}/bookings`, authenticateToken, bookingRoutes);
app.use(`/api/${API_VERSION}/analytics`, authenticateToken, analyticsRoutes);
app.use(`/api/${API_VERSION}/dashboard`, authenticateToken, dashboardRoutes);
app.use(`/api/${API_VERSION}/locations`, authenticateToken, locationRoutes);

// ---------------------------------------------------------------------------
// Socket.io setup for real-time features
// ---------------------------------------------------------------------------
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Be tolerant of slow clients (e.g. mobile on bad networks)
  pingInterval: 25000,
  pingTimeout: 60000,
});

io.on('connection', (socket) => {
  console.log('👤 Socket connected:', socket.id);

  socket.on('join-user-room', (userId) => {
    if (userId) {
      socket.join(`user-${userId}`);
      console.log(`👤 User ${userId} joined their room`);
    }
  });

  socket.on('join-admin-room', () => {
    socket.join('admin-room');
    console.log('👨‍💼 Admin joined admin room');
  });

  socket.on('truck-location-update', (data) => {
    socket.broadcast.emit('truck-location-updated', data);
  });

  socket.on('new-message', (data) => {
    if (data.recipientType === 'admin') {
      socket.to('admin-room').emit('message-received', data);
    } else if (data.recipientId) {
      socket.to(`user-${data.recipientId}`).emit('message-received', data);
    }
  });

  socket.on('new-pickup-request', (data) => {
    socket.to('admin-room').emit('pickup-request-received', data);
  });

  socket.on('truck-dispatched', (data) => {
    if (data.userId) {
      socket.to(`user-${data.userId}`).emit('truck-dispatch-update', data);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('👤 Socket disconnected:', socket.id, '(', reason, ')');
  });
});

// Make io available to routes via app.locals
app.set('socketio', io);

// ---------------------------------------------------------------------------
// 404 handler — MUST come before errorHandler so unknown routes are handled
// ---------------------------------------------------------------------------
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `The requested route ${req.method} ${req.originalUrl} does not exist.`,
  });
});

// Global error handler — MUST be the very last middleware
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🚀 VeloManage Backend running on port ${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`📡 API Base URL: /api/${API_VERSION}`);
  console.log(`🔧 Health Check: /health`);
  console.log(`🌐 Allowed CORS origins: ${allowedOrigins.join(', ')}`);
  if (!JWT_SECRET || JWT_SECRET.includes('fallback')) {
    console.warn('⚠️  WARNING: JWT_SECRET not set — using insecure fallback. Set JWT_SECRET in env vars.');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n${signal} received — shutting down gracefully...`);

  // Stop accepting new connections
  server.close(() => {
    console.log('✅ HTTP server closed.');
  });

  // Close socket.io
  try {
    await new Promise((resolve) => {
      io.close(() => resolve());
    });
    console.log('✅ Socket.io closed.');
  } catch (e) {
    console.error('Error closing socket.io:', e.message);
  }

  // Close mongoose
  try {
    await mongoose.connection.close(false);
    console.log('✅ MongoDB connection closed.');
  } catch (e) {
    console.error('Error closing MongoDB:', e.message);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch uncaught errors so the process never dies silently
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Promise Rejection:', reason);
});

export default app;
